"""Scenario specifications and deterministic seed data.

This package is split into four modules:
- ``specs``: ScenarioSpec dataclass, SPECS table, ANCHOR time
- ``seed``: transaction row generation and balance derivation
- ``calculator``: forecast, confidence, alert calculation per scenario
- ``loader``: scenario loading, reset, and agent recomputation

The public API (``load_scenario``, ``recompute_agent``, ``reset_operational_data``)
is re-exported from this ``__init__`` so existing imports
``from app.services.scenarios import load_scenario`` continue to work.
"""

from app.services.scenarios.loader import load_scenario, recompute_agent, reset_operational_data
from app.services.scenarios.specs import ANCHOR, SPECS, ScenarioSpec

__all__ = [
    "ANCHOR",
    "SPECS",
    "ScenarioSpec",
    "load_scenario",
    "recompute_agent",
    "reset_operational_data",
]
