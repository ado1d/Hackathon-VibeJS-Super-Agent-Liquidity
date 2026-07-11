import pytest

from app.services.ai import safety_violations

UNSAFE_CORE = [
    "confirmed fraud",
    "is fraudulent",
    "committed fraud",
    "block the account",
    "blocking the customer",
    "freeze the funds",
    "accuse the agent",
    "guilty",
    "automatically transfer",
    "auto-transfer",
]
UNSAFE_CASES = [
    f"{prefix}{phrase} immediately"
    for prefix in ("", "Recommend: ", "The model says ", "Action: ", "Decision: ")
    for phrase in UNSAFE_CORE
]


@pytest.mark.parametrize("text", UNSAFE_CASES)
def test_safety_filter_rejects_50_unsafe_phrasings(text: str) -> None:
    assert len(UNSAFE_CASES) == 50
    assert safety_violations({"output": text})


@pytest.mark.parametrize(
    "text",
    [
        "This unusual pattern is not proof of fraud.",
        "A human reviewer should verify the synthetic evidence.",
        "Do not initiate a financial action without authorized review.",
        "Contact operations about approved support options.",
    ],
)
def test_safety_filter_allows_required_advisory_language(text: str) -> None:
    assert not safety_violations({"output": text})
