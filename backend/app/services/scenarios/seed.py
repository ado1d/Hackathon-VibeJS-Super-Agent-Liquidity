"""Transaction row generation and balance derivation for scenarios."""

from datetime import timedelta
from decimal import Decimal

from app.enums import TransactionStatus, TransactionType
from app.models import Agent, Provider, ScenarioRun, Transaction

from app.services.scenarios.specs import ANCHOR, ScenarioSpec


def build_transaction_rows(
    spec: ScenarioSpec, agent: Agent, providers: list[Provider], run: ScenarioRun
) -> list[Transaction]:
    """Generate the deterministic transaction set for a scenario spec."""
    rows: list[Transaction] = []

    def add(
        provider: int,
        kind: TransactionType,
        amount: int,
        minutes_ago: int,
        customer: str,
        status: TransactionStatus = TransactionStatus.SUCCESS,
        sequence: int | None = None,
    ) -> None:
        number = sequence if sequence is not None else len(rows)
        rows.append(
            Transaction(
                external_event_id=f"{spec.code}-{provider}-{number}",
                agent_id=agent.id,
                provider_id=providers[provider].id,
                transaction_type=kind,
                amount=Decimal(amount),
                status=status,
                synthetic_customer_id=customer,
                occurred_at=ANCHOR - timedelta(minutes=minutes_ago),
                scenario_run_id=run.id,
            )
        )

    if spec.code == "baseline":
        for i in range(18):
            add(
                i % len(providers),
                TransactionType.CASH_IN if i % 2 == 0 else TransactionType.CASH_OUT,
                500 + i * 20,
                55 - i * 4,
                f"SYN-{i:03}",
            )
    elif spec.code == "A":
        for i in range(24):
            add(0, TransactionType.CASH_IN, 1000, 58 - i * 2, f"SYN-A-{i:03}")
        for i in range(10):
            add(
                1,
                TransactionType.CASH_OUT if i % 2 else TransactionType.CASH_IN,
                450 + i * 13,
                50 - i * 4,
                f"SYN-B-{i:03}",
            )
        for i in range(8):
            add(
                2,
                TransactionType.CASH_OUT if i % 3 else TransactionType.CASH_IN,
                520 + i * 17,
                48 - i * 5,
                f"SYN-RKT-A-{i:03}",
            )
    elif spec.code == "B":
        for i in range(22):
            add(
                i % 2,
                TransactionType.CASH_OUT,
                1500 + (i % 4) * 25,
                55 - i * 2,
                f"SYN-CASH-{i:03}",
            )
        for i in range(7):
            add(
                0,
                TransactionType.CASH_OUT,
                1000 + (i % 2) * 5,
                9 - i,
                f"SYN-REPEAT-{i % 2}",
                sequence=100 + i,
            )
        for i in range(5):
            add(
                1,
                TransactionType.CASH_OUT,
                700,
                14 - i,
                f"SYN-FAIL-{i}",
                TransactionStatus.FAILED,
                sequence=200 + i,
            )
        for i in range(6):
            add(2, TransactionType.CASH_IN, 650, 35 - i * 4, f"SYN-RKT-B-{i:03}", sequence=300 + i)
    elif spec.code == "C":
        for i in range(15):
            add(i % len(providers), TransactionType.CASH_IN, 800, 55 - i * 3, f"SYN-DQ-{i:03}")
    elif spec.code == "D":
        for i in range(20):
            add(0, TransactionType.CASH_IN, 1100, 48 - i * 2, f"SYN-WORK-{i:03}")
        for i in range(8):
            add(1, TransactionType.CASH_OUT, 500, 40 - i * 4, f"SYN-NORMAL-{i:03}")
        for i in range(8):
            add(2, TransactionType.CASH_OUT, 440, 44 - i * 4, f"SYN-ROCKET-WORK-{i:03}")
    return rows


def derive_balances(
    spec: ScenarioSpec, rows: list[Transaction], providers: list[Provider]
) -> tuple[list[Decimal], Decimal]:
    """Apply successful transactions to opening balances.

    Returns ``(provider_balances, cash_balance)``. For scenario C, an intentional
    7,000 BDT discrepancy is injected into Nagad's reported balance so the
    ledger-balance conflict detector has something to flag.
    """
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
