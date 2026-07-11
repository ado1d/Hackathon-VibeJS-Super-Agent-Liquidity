import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import FeedStatus, Role, Severity, TransactionStatus, TransactionType
from app.errors import AppError
from app.models import (Agent, AgentProviderBalance, Alert, AlertEvent, CashSnapshot,
                        CaseNote, Forecast, IngestionQuarantine, Provider, ProviderFeedStatus,
                        ScenarioRun, Transaction, User)
from app.security import hash_password
from app.services.alerts import upsert_alert
from app.services.anomalies import ledger_balance_conflict, load_thresholds, run_detectors
from app.services.audit import add_audit
from app.services.confidence import ConfidenceInput, calculate_confidence
from app.services.liquidity import RateInput, forecast_liquidity, forecast_shared_cash

ANCHOR = datetime(2026, 7, 11, 4, 30, tzinfo=timezone.utc)  # 10:30 Asia/Dhaka


@dataclass(frozen=True)
class ScenarioSpec:
    code: str
    label: str
    seed: int
    provider_opening: tuple[Decimal, Decimal]
    cash_opening: Decimal
    feed_statuses: tuple[FeedStatus, FeedStatus]
    expected: dict[str, object]


SPECS = {
    "BASELINE": ScenarioSpec("baseline", "Known healthy baseline", 100,
                             (Decimal("90000"), Decimal("110000")), Decimal("100000"),
                             (FeedStatus.FRESH, FeedStatus.FRESH), {"alerts": []}),
    "A": ScenarioSpec("A", "Hidden provider shortage", 101,
                      (Decimal("40000"), Decimal("120000")), Decimal("80000"),
                      (FeedStatus.FRESH, FeedStatus.FRESH), {"provider_shortage": True}),
    "B": ScenarioSpec("B", "Shared-cash pressure with unusual activity", 102,
                      (Decimal("45000"), Decimal("70000")), Decimal("55000"),
                      (FeedStatus.FRESH, FeedStatus.FRESH), {"cash_shortage": True, "unusual": True}),
    "C": ScenarioSpec("C", "Delayed and conflicting provider data", 103,
                      (Decimal("60000"), Decimal("80000")), Decimal("70000"),
                      (FeedStatus.MISSING, FeedStatus.CONFLICTING), {"safe_fallback": True}),
    "D": ScenarioSpec("D", "Coordinated response and closure", 104,
                      (Decimal("32000"), Decimal("90000")), Decimal("65000"),
                      (FeedStatus.FRESH, FeedStatus.FRESH), {"workflow_alert": True}),
}


async def ensure_reference_data(session: AsyncSession) -> None:
    users = (await session.execute(select(User))).scalars().all()
    if not users:
        hashed = hash_password("demo-pass")
        users = [User(username=role.value, display_name=f"Demo {role.value.title()}",
                      password_hash=hashed, role=role) for role in Role]
        session.add_all(users)
        await session.flush()
    by_role = {user.role: user for user in users}
    providers = (await session.execute(select(Provider).order_by(Provider.code))).scalars().all()
    if not providers:
        providers = [Provider(code="PROVIDER_A", display_name="Provider A", color="#dc2626"),
                     Provider(code="PROVIDER_B", display_name="Provider B", color="#2563eb")]
        session.add_all(providers)
    agents = (await session.execute(select(Agent))).scalars().all()
    if not agents:
        session.add_all([
            Agent(code="AG-1001", name="Rahman Store", area="Dhaka North",
                  latitude=Decimal("23.810300"), longitude=Decimal("90.412500"),
                  user_id=by_role[Role.AGENT].id, assigned_operations_user_id=by_role[Role.OPERATIONS].id),
            Agent(code="AG-1002", name="Mitali Telecom", area="Dhaka North",
                  latitude=Decimal("23.814000"), longitude=Decimal("90.418000"),
                  assigned_operations_user_id=by_role[Role.OPERATIONS].id),
            Agent(code="AG-1003", name="Padma Services", area="Dhaka South",
                  latitude=Decimal("23.735000"), longitude=Decimal("90.395000"),
                  assigned_operations_user_id=by_role[Role.OPERATIONS].id),
            Agent(code="AG-1004", name="Meghna Point", area="Dhaka North",
                  latitude=Decimal("23.806000"), longitude=Decimal("90.421000"),
                  assigned_operations_user_id=by_role[Role.OPERATIONS].id),
        ])
    await session.commit()


async def reset_operational_data(session: AsyncSession) -> None:
    for model in (AlertEvent, CaseNote, Alert, Forecast, ProviderFeedStatus, AgentProviderBalance,
                  CashSnapshot, Transaction, IngestionQuarantine):
        await session.execute(delete(model))
    await session.execute(update(ScenarioRun).values(active=False))


def _transaction_rows(spec: ScenarioSpec, agent: Agent, providers: list[Provider], run: ScenarioRun) -> list[Transaction]:
    rows: list[Transaction] = []

    def add(provider: int, kind: TransactionType, amount: int, minutes_ago: int, customer: str,
            status: TransactionStatus = TransactionStatus.SUCCESS, sequence: int | None = None) -> None:
        number = sequence if sequence is not None else len(rows)
        rows.append(Transaction(external_event_id=f"{spec.code}-{provider}-{number}", agent_id=agent.id,
                                provider_id=providers[provider].id, transaction_type=kind,
                                amount=Decimal(amount), status=status, synthetic_customer_id=customer,
                                occurred_at=ANCHOR - timedelta(minutes=minutes_ago), scenario_run_id=run.id))

    if spec.code == "baseline":
        for i in range(12):
            add(i % 2, TransactionType.CASH_IN if i % 2 == 0 else TransactionType.CASH_OUT,
                500 + i * 20, 55 - i * 4, f"SYN-{i:03}")
    elif spec.code == "A":
        for i in range(24):
            add(0, TransactionType.CASH_IN, 1000, 58 - i * 2, f"SYN-A-{i:03}")
        for i in range(10):
            add(1, TransactionType.CASH_OUT if i % 2 else TransactionType.CASH_IN,
                450 + i * 13, 50 - i * 4, f"SYN-B-{i:03}")
    elif spec.code == "B":
        for i in range(22):
            add(i % 2, TransactionType.CASH_OUT, 1500 + (i % 4) * 25, 55 - i * 2, f"SYN-CASH-{i:03}")
        for i in range(7):
            add(0, TransactionType.CASH_OUT, 1000 + (i % 2) * 5, 9 - i,
                f"SYN-REPEAT-{i % 2}", sequence=100 + i)
        for i in range(5):
            add(1, TransactionType.CASH_OUT, 700, 14 - i, f"SYN-FAIL-{i}",
                TransactionStatus.FAILED, sequence=200 + i)
    elif spec.code == "C":
        for i in range(12):
            add(i % 2, TransactionType.CASH_IN, 800, 55 - i * 4, f"SYN-DQ-{i:03}")
    elif spec.code == "D":
        for i in range(20):
            add(0, TransactionType.CASH_IN, 1100, 48 - i * 2, f"SYN-WORK-{i:03}")
        for i in range(8):
            add(1, TransactionType.CASH_OUT, 500, 40 - i * 4, f"SYN-NORMAL-{i:03}")
    return rows


def _derive_balances(spec: ScenarioSpec, rows: list[Transaction], providers: list[Provider]) -> tuple[list[Decimal], Decimal]:
    provider_values = list(spec.provider_opening)
    cash = spec.cash_opening
    provider_index = {provider.id: idx for idx, provider in enumerate(providers)}
    for row in rows:
        if row.status != TransactionStatus.SUCCESS:
            continue
        idx = provider_index[row.provider_id]
        if row.transaction_type == TransactionType.CASH_IN:
            cash += row.amount
            provider_values[idx] -= row.amount
        elif row.transaction_type == TransactionType.CASH_OUT:
            cash -= row.amount
            provider_values[idx] += row.amount
    if spec.code == "C":
        provider_values[1] += Decimal("7000")  # intentional reported/ledger conflict
    return provider_values, cash


async def _calculate_and_alert(session: AsyncSession, spec: ScenarioSpec, run: ScenarioRun,
                               agent: Agent, providers: list[Provider], rows: list[Transaction],
                               balances: list[Decimal], cash: Decimal) -> None:
    settings = get_settings()
    thresholds = load_thresholds(settings.anomaly_config_path)
    confidence_by_provider = []
    forecasts: list[Forecast] = []
    for idx, provider in enumerate(providers):
        provider_rows = [row for row in rows if row.provider_id == provider.id]
        status = spec.feed_statuses[idx]
        confidence = calculate_confidence(ConfidenceInput(feed_status=status,
                                                           sample_count=len(provider_rows),
                                                           baseline_available=spec.code != "C"))
        confidence_by_provider.append(confidence)
        cash_in = sum((row.amount for row in provider_rows if row.status == TransactionStatus.SUCCESS and
                       row.transaction_type == TransactionType.CASH_IN), Decimal("0"))
        cash_out = sum((row.amount for row in provider_rows if row.status == TransactionStatus.SUCCESS and
                        row.transaction_type == TransactionType.CASH_OUT), Decimal("0"))
        result = forecast_liquidity(balances[idx], Decimal(str(settings.provider_min_buffer_bdt)),
                                    RateInput(cash_in, cash_out, settings.medium_window_minutes),
                                    suppress_precise_time=confidence.suppress_precise_time)
        forecast = Forecast(agent_id=agent.id, provider_id=provider.id, resource_type="provider_e_money",
                            current_balance=balances[idx], minimum_buffer=Decimal(str(settings.provider_min_buffer_bdt)),
                            net_consumption_per_minute=result.net_consumption_rate,
                            shortage_minutes=result.shortage_minutes, severity=result.severity,
                            confidence=Decimal(str(confidence.score)), confidence_reasons=confidence.reasons,
                            contributing_factors={"cash_in_rate": float(result.cash_in_rate),
                                                  "cash_out_rate": float(result.cash_out_rate),
                                                  "message": result.message}, reliable=result.reliable,
                            horizon_minutes=settings.forecast_horizon_minutes, scenario_run_id=run.id)
        session.add(forecast)
        forecasts.append(forecast)
        if result.severity in {Severity.CRITICAL, Severity.HIGH, Severity.DATA_ISSUE}:
            await upsert_alert(session, agent_id=agent.id, provider_id=provider.id,
                               alert_type="provider_liquidity" if result.reliable else "data_quality",
                               severity=result.severity,
                               summary=(f"{provider.display_name} e-money may reach its safety buffer in "
                                        f"{result.shortage_minutes} minutes." if result.shortage_minutes is not None
                                        else f"{provider.display_name} has no reliable shortage estimate."),
                               reason=result.message,
                               evidence={"measured": {"balance_bdt": float(balances[idx]),
                                                      "feed_status": status.value},
                                         "forecast": {"shortage_minutes": float(result.shortage_minutes)
                                                      if result.shortage_minutes is not None else None,
                                                      "net_consumption_bdt_per_min": float(result.net_consumption_rate)},
                                         "recommendation": "Verify the feed and contact the assigned operations officer."},
                               confidence=confidence.score, confidence_reasons=confidence.reasons,
                               data_quality_status=status,
                               uncertainty="The estimate may change if demand or feed quality changes.",
                               next_step="Contact the assigned operations officer and verify approved support options.",
                               scenario_run_id=run.id)
        for detection in run_detectors(provider_rows, thresholds, settings.enable_isolation_forest):
            await upsert_alert(session, agent_id=agent.id, provider_id=provider.id,
                               alert_type=detection.alert_type, severity=detection.severity,
                               summary="Unusual activity detected; human review is required.",
                               reason=detection.reason, evidence=detection.evidence,
                               confidence=detection.confidence, confidence_reasons=[
                                   "Rule evidence is calculated from synthetic transactions",
                                   "Unusual activity is not proof of fraud"], data_quality_status=status,
                               uncertainty="The pattern may have a legitimate operational explanation.",
                               next_step="Review the synthetic transactions with supporting context.",
                               scenario_run_id=run.id, assigned_role=Role.RISK)
        conflict = ledger_balance_conflict(spec.provider_opening[idx], balances[idx], provider_rows, thresholds)
        if conflict and spec.code == "C":
            await upsert_alert(session, agent_id=agent.id, provider_id=provider.id,
                               alert_type=conflict.alert_type, severity=conflict.severity,
                               summary="Provider balance and ledger movement conflict.", reason=conflict.reason,
                               evidence=conflict.evidence, confidence=0.5,
                               confidence_reasons=["Conflicting balance snapshot (-0.25)"],
                               data_quality_status=FeedStatus.CONFLICTING,
                               uncertainty="The source of the mismatch is not known.",
                               next_step="Verify the provider feed before taking action.", scenario_run_id=run.id)

    all_in = sum((r.amount for r in rows if r.status == TransactionStatus.SUCCESS and
                  r.transaction_type == TransactionType.CASH_IN), Decimal("0"))
    all_out = sum((r.amount for r in rows if r.status == TransactionStatus.SUCCESS and
                   r.transaction_type == TransactionType.CASH_OUT), Decimal("0"))
    cash_confidence = calculate_confidence(ConfidenceInput(sample_count=len(rows)))
    cash_result = forecast_shared_cash(cash, Decimal(str(settings.cash_min_buffer_bdt)),
                                       RateInput(all_in, all_out, settings.medium_window_minutes))
    session.add(Forecast(agent_id=agent.id, resource_type="shared_cash", current_balance=cash,
                         minimum_buffer=Decimal(str(settings.cash_min_buffer_bdt)),
                         net_consumption_per_minute=cash_result.net_consumption_rate,
                         shortage_minutes=cash_result.shortage_minutes, severity=cash_result.severity,
                         confidence=Decimal(str(cash_confidence.score)), confidence_reasons=cash_confidence.reasons,
                         contributing_factors={"cash_in_rate": float(cash_result.cash_out_rate),
                                               "cash_out_rate": float(cash_result.cash_in_rate),
                                               "message": cash_result.message}, reliable=cash_result.reliable,
                         horizon_minutes=settings.forecast_horizon_minutes, scenario_run_id=run.id))
    if cash_result.severity in {Severity.CRITICAL, Severity.HIGH}:
        await upsert_alert(session, agent_id=agent.id, provider_id=None, alert_type="shared_cash_liquidity",
                           severity=cash_result.severity,
                           summary=f"Shared physical cash may reach its safety buffer in {cash_result.shortage_minutes} minutes.",
                           reason="Cash-out demand is consuming the shared physical reserve.",
                           evidence={"measured": {"cash_bdt": float(cash)},
                                     "forecast": {"shortage_minutes": float(cash_result.shortage_minutes or 0),
                                                  "net_consumption_bdt_per_min": float(cash_result.net_consumption_rate)},
                                     "recommendation": "Arrange approved operational support."},
                           confidence=cash_confidence.score, confidence_reasons=cash_confidence.reasons,
                           data_quality_status=FeedStatus.FRESH,
                           uncertainty="The estimate may change if customer demand normalizes.",
                           next_step="Contact the assigned operations officer to arrange approved support.",
                           scenario_run_id=run.id)


async def recompute_agent(session: AsyncSession, run: ScenarioRun, agent_id: uuid.UUID) -> None:
    """Recalculate current forecasts and alerts after an accepted transaction batch."""
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise AppError("AGENT_NOT_FOUND", "Imported transaction agent was not found.", 404)
    providers = list((await session.execute(select(Provider).order_by(Provider.code))).scalars())
    balances: list[Decimal] = []
    statuses: list[FeedStatus] = []
    for provider in providers:
        balance = (await session.execute(select(AgentProviderBalance).where(
            AgentProviderBalance.agent_id == agent_id,
            AgentProviderBalance.provider_id == provider.id,
            AgentProviderBalance.scenario_run_id == run.id
        ).order_by(AgentProviderBalance.source_timestamp.desc()))).scalars().first()
        if balance is None:
            continue
        balances.append(balance.balance)
        statuses.append(balance.quality_status)
    cash = (await session.execute(select(CashSnapshot).where(
        CashSnapshot.agent_id == agent_id, CashSnapshot.scenario_run_id == run.id
    ).order_by(CashSnapshot.source_timestamp.desc()))).scalars().first()
    if len(balances) != len(providers) or cash is None:
        raise AppError("INGESTION_BALANCE_CONTEXT_MISSING",
                       "The imported agent does not have complete balance context.", 409)
    rows = list((await session.execute(select(Transaction).where(
        Transaction.agent_id == agent_id, Transaction.scenario_run_id == run.id))).scalars())
    await session.execute(delete(Forecast).where(Forecast.agent_id == agent_id,
                                                  Forecast.scenario_run_id == run.id))
    provider_pair = (balances[0], balances[1])
    status_pair = (statuses[0], statuses[1])
    refresh_spec = ScenarioSpec("refresh", run.label, run.seed, provider_pair, cash.balance,
                                status_pair, run.expected_labels)
    await _calculate_and_alert(session, refresh_spec, run, agent, providers, rows, balances, cash.balance)


async def load_scenario(session: AsyncSession, code: str, actor_user_id: uuid.UUID | None = None,
                        if_empty: bool = False) -> ScenarioRun:
    normalized = code.upper()
    if normalized not in SPECS:
        raise AppError("SCENARIO_NOT_FOUND", "Scenario must be baseline, A, B, C, or D.", 404)
    active = (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True)))).scalars().first()
    if if_empty and active is not None:
        return active
    await ensure_reference_data(session)
    if session.bind and session.bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(20260711)"))
    await reset_operational_data(session)
    spec = SPECS[normalized]
    run = ScenarioRun(code=spec.code, label=spec.label, seed=spec.seed, expected_labels=spec.expected)
    session.add(run)
    await session.flush()
    agent = (await session.execute(select(Agent).where(Agent.code == "AG-1001"))).scalar_one()
    providers = list((await session.execute(select(Provider).order_by(Provider.code))).scalars().all())
    rows = _transaction_rows(spec, agent, providers, run)
    balances, cash = _derive_balances(spec, rows, providers)
    session.add_all(rows)
    for idx, provider in enumerate(providers):
        status = spec.feed_statuses[idx]
        source_time = ANCHOR - (timedelta(minutes=30) if status == FeedStatus.MISSING else timedelta(minutes=2))
        session.add(AgentProviderBalance(agent_id=agent.id, provider_id=provider.id, balance=balances[idx],
                                         source_timestamp=source_time, received_timestamp=ANCHOR,
                                         freshness_status=status, quality_status=status,
                                         quality_details={"scenario": spec.code}, scenario_run_id=run.id))
        session.add(ProviderFeedStatus(agent_id=agent.id, provider_id=provider.id, status=status,
                                       last_received_at=source_time, missing_intervals=4 if status == FeedStatus.MISSING else 0,
                                       conflict_details={"reported_difference_bdt": 7000} if status == FeedStatus.CONFLICTING else {},
                                       scenario_run_id=run.id))
    session.add(CashSnapshot(agent_id=agent.id, balance=cash, source_timestamp=ANCHOR,
                             received_timestamp=ANCHOR, quality_status=FeedStatus.FRESH,
                             scenario_run_id=run.id))
    await _calculate_and_alert(session, spec, run, agent, providers, rows, balances, cash)
    await session.flush()
    alert_count = (await session.execute(select(func.count(Alert.id)).where(
        Alert.scenario_run_id == run.id))).scalar_one()
    critical_count = (await session.execute(select(func.count(Alert.id)).where(
        Alert.scenario_run_id == run.id, Alert.severity == Severity.CRITICAL))).scalar_one()
    nearest_shortage = (await session.execute(select(func.min(Forecast.shortage_minutes)).where(
        Forecast.scenario_run_id == run.id, Forecast.shortage_minutes.is_not(None)))).scalar_one()
    run.measured_results = {"alert_count": alert_count, "critical_alert_count": critical_count,
                            "nearest_shortage_minutes": float(nearest_shortage)
                            if nearest_shortage is not None else None}
    run.completed_at = ANCHOR
    add_audit(session, "scenario.loaded", actor_user_id, "scenario_run", str(run.id),
              details={"code": spec.code, "seed": spec.seed})
    await session.commit()
    await session.refresh(run)
    return run
