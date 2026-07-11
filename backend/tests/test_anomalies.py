from datetime import datetime, timedelta, timezone

from app.services.anomalies import (
    failure_rate_spike,
    identifier_concentration,
    repeated_near_identical,
    run_detectors,
)


CONFIG = {
    "repeated": {
        "minimum_count": 5,
        "window_minutes": 10,
        "amount_tolerance_percent": 1,
        "maximum_identifiers": 3,
        "minimum_total_bdt": 5000,
    },
    "velocity": {"z_score": 3},
    "concentration": {"top_identifiers": 3, "value_percent": 70},
    "failure": {"minimum_count": 5, "rate_percent": 40},
    "operating_hours": {"start_hour": 7, "end_hour": 22},
    "ledger_conflict": {"tolerance_bdt": 1},
    "isolation_forest": {"contamination": 0.05, "score_threshold": -0.05},
}


def rows(count: int = 6, status: str = "success") -> list[dict]:
    now = datetime(2026, 7, 11, 10, tzinfo=timezone.utc)
    return [
        {
            "amount": 1000 + i % 2,
            "occurred_at": now - timedelta(minutes=i),
            "status": status,
            "synthetic_customer_id": f"SYN-{i % 2}",
        }
        for i in range(count)
    ]


def test_repeated_pattern_has_structured_evidence() -> None:
    result = repeated_near_identical(rows(), CONFIG)
    assert result is not None
    assert result.evidence["count"] == 6
    assert result.evidence["identifier_count"] == 2


def test_failure_and_concentration_rules() -> None:
    failed = rows(6, "failed") + rows(4)
    assert failure_rate_spike(failed, CONFIG) is not None
    assert identifier_concentration(rows(), CONFIG) is not None


def test_detector_suite_never_labels_fraud() -> None:
    results = run_detectors(rows(24), CONFIG, enable_iforest=False)
    assert results
    assert all("fraud" not in item.reason.lower() for item in results)
