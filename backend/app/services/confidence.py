from dataclasses import dataclass

from app.enums import FeedStatus


@dataclass(frozen=True)
class ConfidenceInput:
    feed_status: FeedStatus = FeedStatus.FRESH
    missing_intervals: int = 0
    sample_count: int = 30
    volatility: float = 0.0
    baseline_available: bool = True


@dataclass(frozen=True)
class ConfidenceResult:
    score: float
    reasons: list[str]
    suppress_precise_time: bool


def calculate_confidence(value: ConfidenceInput) -> ConfidenceResult:
    score = 1.0
    reasons: list[str] = []
    suppress = False
    if value.feed_status == FeedStatus.DELAYED:
        score -= 0.20
        reasons.append("Provider feed is delayed (-0.20)")
    elif value.feed_status == FeedStatus.MISSING:
        score -= 0.45
        suppress = True
        reasons.append("Provider feed is missing (-0.45); precise shortage time suppressed")
    elif value.feed_status == FeedStatus.CONFLICTING:
        score -= 0.25
        suppress = True
        reasons.append("Balance snapshots conflict (-0.25); precise shortage time suppressed")
    else:
        reasons.append("Feed is fresh and internally consistent")
    if value.missing_intervals > 0:
        penalty = min(0.15, value.missing_intervals * 0.03)
        score -= penalty
        reasons.append(f"{value.missing_intervals} expected intervals are absent (-{penalty:.2f})")
    if value.sample_count < 10:
        score -= 0.15
        reasons.append("Fewer than 10 recent transactions are available (-0.15)")
    else:
        reasons.append(f"{value.sample_count} recent transactions are available")
    if value.volatility > 0.50:
        score -= 0.10
        reasons.append("Recent demand volatility is high (-0.10)")
    if not value.baseline_available:
        score -= 0.10
        reasons.append("A comparable baseline is unavailable (-0.10)")
    return ConfidenceResult(round(max(0.0, min(1.0, score)), 4), reasons, suppress)

