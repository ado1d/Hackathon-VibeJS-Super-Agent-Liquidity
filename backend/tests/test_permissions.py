from app.enums import Role
from app.permissions import has_permission, permissions_for


def test_admin_has_wildcard_permission() -> None:
    assert "*" in permissions_for(Role.ADMIN)
    assert has_permission(Role.ADMIN, "anything:whatever")


def test_agent_cannot_resolve_alerts() -> None:
    assert not has_permission(Role.AGENT, "alert:resolve")
    assert "alert:own:acknowledge" in permissions_for(Role.AGENT)


def test_operations_can_coordinate_and_resolve() -> None:
    perms = set(permissions_for(Role.OPERATIONS))
    assert {"alert:view", "alert:coordinate", "alert:resolve", "metrics:view"} <= perms


def test_management_is_aggregate_only() -> None:
    perms = set(permissions_for(Role.MANAGEMENT))
    assert perms == {"summary:view", "metrics:view"}


def test_risk_can_review_and_resolve() -> None:
    perms = set(permissions_for(Role.RISK))
    assert {"alert:escalated", "alert:review", "alert:resolve"} <= perms
