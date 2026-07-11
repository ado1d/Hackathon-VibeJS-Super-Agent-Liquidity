from decimal import Decimal

from app.enums import Severity
from app.services.liquidity import RateInput, forecast_liquidity, forecast_shared_cash


def test_provider_e_money_consumed_by_cash_in() -> None:
    result = forecast_liquidity(Decimal("22000"), Decimal("5000"),
                                RateInput(Decimal("30600"), Decimal("10800"), 60))
    assert result.net_consumption_rate == Decimal("330")
    assert result.shortage_minutes == Decimal("51.52")
    assert result.severity == Severity.HIGH


def test_shared_cash_consumed_by_cash_out() -> None:
    result = forecast_shared_cash(Decimal("22000"), Decimal("10000"),
                                  RateInput(Decimal("3000"), Decimal("15000"), 60))
    assert result.net_consumption_rate == Decimal("200")
    assert result.shortage_minutes == Decimal("60.00")


def test_zero_consumption_returns_no_estimate() -> None:
    result = forecast_liquidity(Decimal("50000"), Decimal("5000"),
                                RateInput(Decimal("1000"), Decimal("2000"), 15))
    assert result.shortage_minutes is None
    assert result.reliable


def test_low_confidence_suppresses_precision() -> None:
    result = forecast_liquidity(Decimal("50000"), Decimal("5000"),
                                RateInput(Decimal("10000"), Decimal("0"), 15),
                                suppress_precise_time=True)
    assert result.shortage_minutes is None
    assert result.severity == Severity.DATA_ISSUE

