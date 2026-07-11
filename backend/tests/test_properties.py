from decimal import Decimal

from hypothesis import given, strategies as st

from app.enums import FeedStatus
from app.services.confidence import ConfidenceInput, calculate_confidence
from app.services.liquidity import RateInput, forecast_liquidity


money = st.integers(min_value=0, max_value=10_000_000)
positive = st.integers(min_value=1, max_value=1_000_000)


@given(balance=money, buffer=money, cash_in=money, cash_out=money)
def test_shortage_results_are_never_negative(
    balance: int, buffer: int, cash_in: int, cash_out: int
) -> None:
    result = forecast_liquidity(
        Decimal(balance), Decimal(buffer), RateInput(Decimal(cash_in), Decimal(cash_out), 60)
    )
    assert result.shortage_minutes is None or result.shortage_minutes >= 0


@given(balance=positive, buffer=money, base=positive, increase=positive)
def test_higher_consumption_cannot_increase_lead_time(
    balance: int, buffer: int, base: int, increase: int
) -> None:
    effective_balance = Decimal(max(balance, buffer + 1))
    low = forecast_liquidity(
        effective_balance, Decimal(buffer), RateInput(Decimal(base), Decimal(0), 60)
    )
    high = forecast_liquidity(
        effective_balance,
        Decimal(buffer),
        RateInput(Decimal(base + increase), Decimal(0), 60),
    )
    assert low.shortage_minutes is not None and high.shortage_minutes is not None
    assert high.shortage_minutes <= low.shortage_minutes


@given(buffer=money, consumption=positive, extra=positive)
def test_higher_balance_cannot_reduce_lead_time(buffer: int, consumption: int, extra: int) -> None:
    low_balance = Decimal(buffer + 1)
    rates = RateInput(Decimal(consumption), Decimal(0), 60)
    low = forecast_liquidity(low_balance, Decimal(buffer), rates)
    high = forecast_liquidity(low_balance + Decimal(extra), Decimal(buffer), rates)
    assert low.shortage_minutes is not None and high.shortage_minutes is not None
    assert high.shortage_minutes >= low.shortage_minutes


@given(
    missing=st.integers(min_value=0, max_value=20),
    samples=st.integers(min_value=0, max_value=100),
    volatility=st.floats(min_value=0, max_value=3, allow_nan=False),
)
def test_confidence_is_always_clamped(missing: int, samples: int, volatility: float) -> None:
    result = calculate_confidence(
        ConfidenceInput(
            feed_status=FeedStatus.MISSING,
            missing_intervals=missing,
            sample_count=samples,
            volatility=volatility,
            baseline_available=False,
        )
    )
    assert 0 <= result.score <= 1


def test_additional_penalties_cannot_increase_confidence() -> None:
    baseline = calculate_confidence(ConfidenceInput()).score
    sparse = calculate_confidence(ConfidenceInput(sample_count=2)).score
    sparse_delayed = calculate_confidence(
        ConfidenceInput(feed_status=FeedStatus.DELAYED, sample_count=2)
    ).score
    sparse_delayed_volatile = calculate_confidence(
        ConfidenceInput(feed_status=FeedStatus.DELAYED, sample_count=2, volatility=0.9)
    ).score
    assert baseline >= sparse >= sparse_delayed >= sparse_delayed_volatile
