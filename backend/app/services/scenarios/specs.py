"""Scenario specifications: dataclass, SPECS table, anchor time."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from app.enums import FeedStatus

# All scenario time is anchored at 2026-07-11 10:30 Asia/Dhaka (UTC+6).
ANCHOR = datetime(2026, 7, 11, 4, 30, tzinfo=timezone.utc)


@dataclass(frozen=True)
class ScenarioSpec:
    code: str
    label: str
    seed: int
    provider_opening: tuple[Decimal, Decimal]
    cash_opening: Decimal
    feed_statuses: tuple[FeedStatus, FeedStatus]
    expected: dict[str, object]


SPECS: dict[str, ScenarioSpec] = {
    "BASELINE": ScenarioSpec(
        "baseline",
        "Known healthy baseline",
        100,
        (Decimal("90000"), Decimal("110000")),
        Decimal("100000"),
        (FeedStatus.FRESH, FeedStatus.FRESH),
        {"alerts": []},
    ),
    "A": ScenarioSpec(
        "A",
        "Hidden provider shortage",
        101,
        (Decimal("40000"), Decimal("120000")),
        Decimal("80000"),
        (FeedStatus.FRESH, FeedStatus.FRESH),
        {"provider_shortage": True},
    ),
    "B": ScenarioSpec(
        "B",
        "Shared-cash pressure with unusual activity",
        102,
        (Decimal("45000"), Decimal("70000")),
        Decimal("55000"),
        (FeedStatus.FRESH, FeedStatus.FRESH),
        {"cash_shortage": True, "unusual": True},
    ),
    "C": ScenarioSpec(
        "C",
        "Delayed and conflicting provider data",
        103,
        (Decimal("60000"), Decimal("80000")),
        Decimal("70000"),
        (FeedStatus.MISSING, FeedStatus.CONFLICTING),
        {"safe_fallback": True},
    ),
    "D": ScenarioSpec(
        "D",
        "Coordinated response and closure",
        104,
        (Decimal("32000"), Decimal("90000")),
        Decimal("65000"),
        (FeedStatus.FRESH, FeedStatus.FRESH),
        {"workflow_alert": True},
    ),
}
