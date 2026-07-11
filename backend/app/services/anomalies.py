from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from statistics import mean, pstdev
from typing import Any, Iterable

import numpy as np
import yaml  # type: ignore[import-untyped]
from sklearn.ensemble import IsolationForest

from app.enums import Severity, TransactionStatus


@dataclass(frozen=True)
class Detection:
    alert_type: str
    severity: Severity
    reason: str
    evidence: dict[str, Any]
    confidence: float = 0.85


def _v(item: Any, name: str) -> Any:
    return item[name] if isinstance(item, dict) else getattr(item, name)


def load_thresholds(path: str) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as source:
        return yaml.safe_load(source)


def successful(items: Iterable[Any]) -> list[Any]:
    return [item for item in items if str(_v(item, "status")) in {"success", TransactionStatus.SUCCESS.value}]


def repeated_near_identical(items: Iterable[Any], config: dict[str, Any]) -> Detection | None:
    txs = sorted(successful(items), key=lambda item: _v(item, "occurred_at"))
    cfg = config["repeated"]
    if len(txs) < cfg["minimum_count"]:
        return None
    end = _v(txs[-1], "occurred_at")
    window = [t for t in txs if _v(t, "occurred_at") >= end - timedelta(minutes=cfg["window_minutes"])]
    amounts = [Decimal(str(_v(t, "amount"))) for t in window]
    ids = {_v(t, "synthetic_customer_id") for t in window}
    if len(window) < cfg["minimum_count"] or len(ids) > cfg["maximum_identifiers"]:
        return None
    midpoint = sum(amounts, Decimal("0")) / len(amounts)
    tolerance = midpoint * Decimal(str(cfg["amount_tolerance_percent"])) / 100
    total = sum(amounts, Decimal("0"))
    if max(amounts) - min(amounts) > tolerance * 2 or total < Decimal(str(cfg["minimum_total_bdt"])):
        return None
    return Detection("repeated_near_identical", Severity.HIGH,
                     "Repeated near-identical transactions require contextual review.", {
                         "count": len(window), "window_minutes": cfg["window_minutes"],
                         "amount_min_bdt": float(min(amounts)), "amount_max_bdt": float(max(amounts)),
                         "identifier_count": len(ids), "total_bdt": float(total),
                         "baseline_comparison": "Pattern exceeds the configured normal count and concentration limits",
                     })


def velocity_spike(items: Iterable[Any], config: dict[str, Any], baseline_counts: list[int] | None = None) -> Detection | None:
    count = len(successful(items))
    baseline = baseline_counts or [4, 5, 6, 5, 4, 7, 5]
    avg, std = mean(baseline), pstdev(baseline)
    threshold = avg + config["velocity"]["z_score"] * std
    if count <= threshold:
        return None
    return Detection("velocity_spike", Severity.MEDIUM, "Transaction velocity is above the synthetic baseline.",
                     {"observed_count": count, "baseline_mean": avg, "baseline_stddev": std,
                      "threshold": threshold, "window_minutes": 15})


def identifier_concentration(items: Iterable[Any], config: dict[str, Any]) -> Detection | None:
    txs = successful(items)
    totals: dict[str, float] = {}
    for tx in txs:
        key = str(_v(tx, "synthetic_customer_id"))
        totals[key] = totals.get(key, 0.0) + float(_v(tx, "amount"))
    overall = sum(totals.values())
    if not overall:
        return None
    cfg = config["concentration"]
    top = sorted(totals.items(), key=lambda item: item[1], reverse=True)[:cfg["top_identifiers"]]
    percent = sum(value for _, value in top) / overall * 100
    if percent <= cfg["value_percent"]:
        return None
    return Detection("identifier_concentration", Severity.MEDIUM,
                     "A small set of synthetic identifiers contributes an unusual share of value.",
                     {"top_identifiers": [key for key, _ in top], "value_percent": round(percent, 2),
                      "threshold_percent": cfg["value_percent"], "total_bdt": overall})


def failure_rate_spike(items: Iterable[Any], config: dict[str, Any]) -> Detection | None:
    txs = list(items)
    failures = [t for t in txs if str(_v(t, "status")) in {"failed", TransactionStatus.FAILED.value}]
    cfg = config["failure"]
    rate = (len(failures) / len(txs) * 100) if txs else 0
    if len(failures) < cfg["minimum_count"] or rate < cfg["rate_percent"]:
        return None
    return Detection("failure_rate_spike", Severity.MEDIUM,
                     "The recent failure rate is above the configured review threshold.",
                     {"failure_count": len(failures), "transaction_count": len(txs),
                      "failure_rate_percent": round(rate, 2), "threshold_percent": cfg["rate_percent"]})


def outside_operating_hours(items: Iterable[Any], config: dict[str, Any]) -> Detection | None:
    cfg = config["operating_hours"]
    outside = [t for t in successful(items)
               if not cfg["start_hour"] <= _v(t, "occurred_at").hour < cfg["end_hour"]]
    if not outside:
        return None
    return Detection("outside_operating_hours", Severity.WATCH,
                     "Successful activity occurred outside the simulated operating window.",
                     {"count": len(outside), "operating_window": f"{cfg['start_hour']:02}:00-{cfg['end_hour']:02}:00",
                      "timestamps": [_v(t, "occurred_at").isoformat() for t in outside[:10]]})


def ledger_balance_conflict(opening: Decimal, reported: Decimal, items: Iterable[Any],
                            config: dict[str, Any]) -> Detection | None:
    expected = opening
    for tx in successful(items):
        amount = Decimal(str(_v(tx, "amount")))
        expected += amount if str(_v(tx, "transaction_type")) == "cash_out" else -amount
    difference = abs(expected - reported)
    if difference <= Decimal(str(config["ledger_conflict"]["tolerance_bdt"])):
        return None
    return Detection("ledger_balance_conflict", Severity.DATA_ISSUE,
                     "Reported provider balance conflicts with successful ledger movement.",
                     {"opening_balance_bdt": float(opening), "expected_balance_bdt": float(expected),
                      "reported_balance_bdt": float(reported), "difference_bdt": float(difference)})


def isolation_forest_detection(items: Iterable[Any], config: dict[str, Any], enabled: bool = True) -> Detection | None:
    txs = list(items)
    if not enabled or len(txs) < 20:
        return None
    features = np.array([[float(_v(t, "amount")), _v(t, "occurred_at").hour,
                          1.0 if str(_v(t, "status")) == "failed" else 0.0] for t in txs])
    model = IsolationForest(contamination=config["isolation_forest"]["contamination"], random_state=20260711)
    scores = model.fit(features).decision_function(features)
    worst = int(np.argmin(scores))
    if scores[worst] >= config["isolation_forest"]["score_threshold"]:
        return None
    baseline = np.percentile(features, [25, 50, 75], axis=0)
    return Detection("isolation_forest_signal", Severity.WATCH,
                     "A secondary statistical scorer found a transaction requiring review.", {
                         "anomaly_score": round(float(scores[worst]), 4),
                         "observed_features": {"amount_bdt": features[worst][0], "hour": features[worst][1],
                                               "failed": bool(features[worst][2])},
                         "baseline_percentiles": {"p25": baseline[0].tolist(), "p50": baseline[1].tolist(),
                                                  "p75": baseline[2].tolist()},
                         "interpretation": "Secondary signal only; it is not proof of fraud",
                     }, confidence=0.65)


def run_detectors(items: Iterable[Any], config: dict[str, Any], enable_iforest: bool = True) -> list[Detection]:
    txs = list(items)
    results = [repeated_near_identical(txs, config), velocity_spike(txs, config),
               identifier_concentration(txs, config), failure_rate_spike(txs, config),
               outside_operating_hours(txs, config), isolation_forest_detection(txs, config, enable_iforest)]
    return [result for result in results if result is not None]
