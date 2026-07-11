"""Forecast, confidence, and alert calculation per scenario.

This module is the analytical core of a scenario load. Given a session, a
``ScenarioSpec``, the seeded transactions, and the derived balances, it:

1. Computes per-provider confidence from feed status and sample size.
2. Forecasts provider e-money shortage time (or suppresses it when confidence is low).
3. Emits provider liquidity / data-quality / anomaly alerts as appropriate.
4. Forecasts shared physical cash shortage and emits a cash alert if needed.

Every alert carries reason, evidence, confidence reasons, an uncertainty
statement, and a safe next step — the four fields the PRD requires.
"""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import FeedStatus, Role, Severity, TransactionStatus, TransactionType
from app.models import Agent, Forecast, Provider, ScenarioRun, Transaction
from app.services.alerts import upsert_alert
from app.services.anomalies import ledger_balance_conflict, load_thresholds, run_detectors
from app.services.confidence import ConfidenceInput, calculate_confidence
from app.services.liquidity import RateInput, forecast_liquidity, forecast_shared_cash

from app.services.scenarios.specs import ScenarioSpec


def _sum_amounts(
    rows: list[Transaction],
    tx_type: TransactionType,
) -> Decimal:
    return sum(
        (
            row.amount
            for row in rows
            if row.status == TransactionStatus.SUCCESS and row.transaction_type == tx_type
        ),
        Decimal("0"),
    )


async def _calculate_provider(
    session: AsyncSession,
    spec: ScenarioSpec,
    run: ScenarioRun,
    agent: Agent,
    provider: Provider,
    provider_opening: Decimal,
    provider_rows: list[Transaction],
    balance: Decimal,
    feed_status: FeedStatus,
    thresholds: dict[str, object],
    enable_iforest: bool,
) -> None:
    settings = get_settings()
    confidence = calculate_confidence(
        ConfidenceInput(
            feed_status=feed_status,
            sample_count=len(provider_rows),
            baseline_available=spec.code != "C",
        )
    )

    cash_in = _sum_amounts(provider_rows, TransactionType.CASH_IN)
    cash_out = _sum_amounts(provider_rows, TransactionType.CASH_OUT)
    result = forecast_liquidity(
        balance,
        Decimal(str(settings.provider_min_buffer_bdt)),
        RateInput(cash_in, cash_out, settings.medium_window_minutes),
        suppress_precise_time=confidence.suppress_precise_time,
    )

    forecast = Forecast(
        agent_id=agent.id,
        provider_id=provider.id,
        resource_type="provider_e_money",
        current_balance=balance,
        minimum_buffer=Decimal(str(settings.provider_min_buffer_bdt)),
        net_consumption_per_minute=result.net_consumption_rate,
        shortage_minutes=result.shortage_minutes,
        severity=result.severity,
        confidence=Decimal(str(confidence.score)),
        confidence_reasons=confidence.reasons,
        contributing_factors={
            "cash_in_rate": float(result.cash_in_rate),
            "cash_out_rate": float(result.cash_out_rate),
            "message": result.message,
        },
        reliable=result.reliable,
        horizon_minutes=settings.forecast_horizon_minutes,
        scenario_run_id=run.id,
    )
    session.add(forecast)

    if result.severity in {Severity.CRITICAL, Severity.HIGH, Severity.DATA_ISSUE}:
        summary = (
            f"{provider.display_name} e-money may reach its safety buffer in "
            f"{result.shortage_minutes} minutes."
            if result.shortage_minutes is not None
            else f"{provider.display_name} has no reliable shortage estimate."
        )
        await upsert_alert(
            session,
            agent_id=agent.id,
            provider_id=provider.id,
            alert_type="provider_liquidity" if result.reliable else "data_quality",
            severity=result.severity,
            summary=summary,
            reason=result.message,
            evidence={
                "measured": {"balance_bdt": float(balance), "feed_status": feed_status.value},
                "forecast": {
                    "shortage_minutes": float(result.shortage_minutes)
                    if result.shortage_minutes is not None
                    else None,
                    "net_consumption_bdt_per_min": float(result.net_consumption_rate),
                },
                "recommendation": "Verify the feed and contact the assigned operations officer.",
            },
            confidence=confidence.score,
            confidence_reasons=confidence.reasons,
            data_quality_status=feed_status,
            uncertainty="The estimate may change if demand or feed quality changes.",
            next_step="Contact the assigned operations officer and verify approved support options.",
            scenario_run_id=run.id,
        )

    for detection in run_detectors(provider_rows, thresholds, enable_iforest):
        await upsert_alert(
            session,
            agent_id=agent.id,
            provider_id=provider.id,
            alert_type=detection.alert_type,
            severity=detection.severity,
            summary="Unusual activity detected; human review is required.",
            reason=detection.reason,
            evidence=detection.evidence,
            confidence=detection.confidence,
            confidence_reasons=[
                "Rule evidence is calculated from synthetic transactions",
                "Unusual activity is not proof of fraud",
            ],
            data_quality_status=feed_status,
            uncertainty="The pattern may have a legitimate operational explanation.",
            next_step="Review the synthetic transactions with supporting context.",
            scenario_run_id=run.id,
            assigned_role=Role.RISK,
        )

    # Compare the reported balance against the opening balance plus ledger movement.
    # ``provider_opening`` is the per-provider opening used to seed the scenario;
    # for transaction imports the loader builds a refresh spec whose opening is
    # the pre-import balance, so this same code path also catches conflicts
    # introduced by an import.
    conflict = ledger_balance_conflict(provider_opening, balance, provider_rows, thresholds)
    if conflict and spec.code == "C":
        await upsert_alert(
            session,
            agent_id=agent.id,
            provider_id=provider.id,
            alert_type=conflict.alert_type,
            severity=conflict.severity,
            summary="Provider balance and ledger movement conflict.",
            reason=conflict.reason,
            evidence=conflict.evidence,
            confidence=0.5,
            confidence_reasons=["Conflicting balance snapshot (-0.25)"],
            data_quality_status=FeedStatus.CONFLICTING,
            uncertainty="The source of the mismatch is not known.",
            next_step="Verify the provider feed before taking action.",
            scenario_run_id=run.id,
        )


async def _calculate_shared_cash(
    session: AsyncSession,
    spec: ScenarioSpec,
    run: ScenarioRun,
    agent: Agent,
    rows: list[Transaction],
    cash: Decimal,
) -> None:
    settings = get_settings()
    all_in = _sum_amounts(rows, TransactionType.CASH_IN)
    all_out = _sum_amounts(rows, TransactionType.CASH_OUT)

    cash_confidence = calculate_confidence(ConfidenceInput(sample_count=len(rows)))
    cash_result = forecast_shared_cash(
        cash,
        Decimal(str(settings.cash_min_buffer_bdt)),
        RateInput(all_in, all_out, settings.medium_window_minutes),
    )

    session.add(
        Forecast(
            agent_id=agent.id,
            resource_type="shared_cash",
            current_balance=cash,
            minimum_buffer=Decimal(str(settings.cash_min_buffer_bdt)),
            net_consumption_per_minute=cash_result.net_consumption_rate,
            shortage_minutes=cash_result.shortage_minutes,
            severity=cash_result.severity,
            confidence=Decimal(str(cash_confidence.score)),
            confidence_reasons=cash_confidence.reasons,
            contributing_factors={
                "cash_in_rate": float(cash_result.cash_out_rate),
                "cash_out_rate": float(cash_result.cash_in_rate),
                "message": cash_result.message,
            },
            reliable=cash_result.reliable,
            horizon_minutes=settings.forecast_horizon_minutes,
            scenario_run_id=run.id,
        )
    )

    if cash_result.severity in {Severity.CRITICAL, Severity.HIGH}:
        await upsert_alert(
            session,
            agent_id=agent.id,
            provider_id=None,
            alert_type="shared_cash_liquidity",
            severity=cash_result.severity,
            summary=f"Shared physical cash may reach its safety buffer in {cash_result.shortage_minutes} minutes.",
            reason="Cash-out demand is consuming the shared physical reserve.",
            evidence={
                "measured": {"cash_bdt": float(cash)},
                "forecast": {
                    "shortage_minutes": float(cash_result.shortage_minutes or 0),
                    "net_consumption_bdt_per_min": float(cash_result.net_consumption_rate),
                },
                "recommendation": "Arrange approved operational support.",
            },
            confidence=cash_confidence.score,
            confidence_reasons=cash_confidence.reasons,
            data_quality_status=FeedStatus.FRESH,
            uncertainty="The estimate may change if customer demand normalizes.",
            next_step="Contact the assigned operations officer to arrange approved support.",
            scenario_run_id=run.id,
        )


async def calculate_and_alert(
    session: AsyncSession,
    spec: ScenarioSpec,
    run: ScenarioRun,
    agent: Agent,
    providers: list[Provider],
    rows: list[Transaction],
    balances: list[Decimal],
    cash: Decimal,
) -> None:
    """Run forecasts and emit alerts for every provider and for shared cash."""
    settings = get_settings()
    thresholds = load_thresholds(settings.anomaly_config_path)

    for idx, provider in enumerate(providers):
        provider_rows = [row for row in rows if row.provider_id == provider.id]
        await _calculate_provider(
            session,
            spec,
            run,
            agent,
            provider,
            spec.provider_opening[idx],
            provider_rows,
            balances[idx],
            spec.feed_statuses[idx],
            thresholds,
            settings.enable_isolation_forest,
        )

    await _calculate_shared_cash(session, spec, run, agent, rows, cash)
