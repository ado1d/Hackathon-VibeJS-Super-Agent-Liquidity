from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from app.enums import Severity

ZERO = Decimal("0")


@dataclass(frozen=True)
class RateInput:
    cash_in_amount: Decimal
    cash_out_amount: Decimal
    window_minutes: int


@dataclass(frozen=True)
class LiquidityResult:
    current_balance: Decimal
    minimum_buffer: Decimal
    cash_in_rate: Decimal
    cash_out_rate: Decimal
    net_consumption_rate: Decimal
    shortage_minutes: Decimal | None
    severity: Severity
    reliable: bool
    message: str


def per_minute(amount: Decimal, minutes: int) -> Decimal:
    if minutes <= 0:
        raise ValueError("window minutes must be positive")
    return amount / Decimal(minutes)


def severity_for(shortage_minutes: Decimal | None, below_buffer: bool = False) -> Severity:
    if below_buffer or (shortage_minutes is not None and shortage_minutes <= 30):
        return Severity.CRITICAL
    if shortage_minutes is not None and shortage_minutes <= 120:
        return Severity.HIGH
    if shortage_minutes is not None and shortage_minutes <= 360:
        return Severity.MEDIUM
    return Severity.WATCH


def forecast_liquidity(
    balance: Decimal,
    buffer: Decimal,
    rates: RateInput,
    reliable: bool = True,
    suppress_precise_time: bool = False,
    demand_multiplier: Decimal = Decimal("1"),
) -> LiquidityResult:
    cash_in_rate = per_minute(rates.cash_in_amount, rates.window_minutes) * demand_multiplier
    cash_out_rate = per_minute(rates.cash_out_amount, rates.window_minutes) * demand_multiplier
    net = max(ZERO, cash_in_rate - cash_out_rate)
    available = balance - buffer
    if not reliable or suppress_precise_time:
        return LiquidityResult(
            balance,
            buffer,
            cash_in_rate,
            cash_out_rate,
            net,
            None,
            Severity.DATA_ISSUE,
            False,
            "No reliable shortage estimate because data confidence is low.",
        )
    if available <= ZERO:
        return LiquidityResult(
            balance,
            buffer,
            cash_in_rate,
            cash_out_rate,
            net,
            ZERO,
            Severity.CRITICAL,
            True,
            "The resource is already at or below its safety buffer.",
        )
    if net <= ZERO:
        return LiquidityResult(
            balance,
            buffer,
            cash_in_rate,
            cash_out_rate,
            net,
            None,
            Severity.WATCH,
            True,
            "No reliable shortage estimate because recent net consumption is zero or negative.",
        )
    minutes = (available / net).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return LiquidityResult(
        balance,
        buffer,
        cash_in_rate,
        cash_out_rate,
        net,
        minutes,
        severity_for(minutes),
        True,
        f"Projected safety-buffer pressure in approximately {minutes} minutes.",
    )


def forecast_shared_cash(
    balance: Decimal,
    buffer: Decimal,
    rates: RateInput,
    reliable: bool = True,
    suppress_precise_time: bool = False,
    demand_multiplier: Decimal = Decimal("1"),
) -> LiquidityResult:
    # Shared cash is consumed by cash-out, the inverse of provider e-money consumption.
    inverse = RateInput(rates.cash_out_amount, rates.cash_in_amount, rates.window_minutes)
    return forecast_liquidity(
        balance, buffer, inverse, reliable, suppress_precise_time, demand_multiplier
    )
