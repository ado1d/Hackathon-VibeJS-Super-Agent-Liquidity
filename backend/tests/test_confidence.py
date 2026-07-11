from app.enums import FeedStatus
from app.services.confidence import ConfidenceInput, calculate_confidence


def test_fresh_confidence_is_full() -> None:
    result = calculate_confidence(ConfidenceInput(sample_count=30))
    assert result.score == 1.0
    assert not result.suppress_precise_time


def test_missing_feed_penalties_are_explained() -> None:
    result = calculate_confidence(ConfidenceInput(feed_status=FeedStatus.MISSING,
                                                   missing_intervals=2, sample_count=4,
                                                   volatility=0.8, baseline_available=False))
    assert result.score == 0.14
    assert result.suppress_precise_time
    assert len(result.reasons) == 5

