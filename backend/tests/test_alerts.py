import pytest

from app.enums import AlertStatus
from app.errors import AppError
from app.services.alerts import TRANSITIONS, validate_transition


def test_state_machine_matches_prd() -> None:
    assert TRANSITIONS[AlertStatus.RESOLVED] == {AlertStatus.REOPENED}
    assert AlertStatus.RESOLVED in TRANSITIONS[AlertStatus.ESCALATED]
    assert AlertStatus.ACKNOWLEDGED in TRANSITIONS[AlertStatus.NEW]


def test_invalid_transition_has_standard_code() -> None:
    with pytest.raises(AppError) as caught:
        validate_transition(AlertStatus.RESOLVED, AlertStatus.ESCALATED)
    assert caught.value.code == "ALERT_INVALID_TRANSITION"
