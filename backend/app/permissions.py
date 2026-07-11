"""Role-permission map and helpers.

This module is the single source of truth for what each role is allowed to do.
The permission strings are surfaced to the frontend via the ``permissions``
field on the login response (see ``app/api/auth.py``), so the UI can
show/hide actions without round-tripping to the server.

Server-side enforcement happens through ``require_roles`` (in ``app/api/deps.py``)
for the existing routes, which check role membership directly. For new
endpoints, prefer ``require_permission("alert:resolve")`` — it consults the
``PERMISSIONS`` map below and stays in sync with what the frontend believes.

Keep the keys here and the role checks in the API handlers in agreement. If
you change a permission here, audit the corresponding route handler.
"""

from app.enums import Role

PERMISSIONS: dict[Role, set[str]] = {
    Role.AGENT: {
        "agent:own",
        "alert:own:view",
        "alert:own:acknowledge",
        "alert:support-request",
    },
    Role.OPERATIONS: {
        "agent:assigned",
        "alert:view",
        "alert:coordinate",
        "alert:resolve",
        "metrics:view",
    },
    Role.RISK: {
        "alert:escalated",
        "alert:review",
        "alert:resolve",
        "metrics:view",
    },
    Role.MANAGEMENT: {
        "summary:view",
        "metrics:view",
    },
    Role.ADMIN: {"*"},
}


def permissions_for(role: Role) -> list[str]:
    """Return the sorted list of permission strings attached to a role.

    ADMIN always returns ``["*"]`` and is treated as a wildcard by
    ``has_permission``.
    """
    return sorted(PERMISSIONS[role])


def has_permission(role: Role, permission: str) -> bool:
    """True if ``role`` grants ``permission``. ADMIN matches anything."""
    if permission in PERMISSIONS[role]:
        return True
    return "*" in PERMISSIONS[role]


ROLE_LANDING_PATHS: dict[Role, str] = {
    Role.AGENT: "/my-agent",
    Role.OPERATIONS: "/operations",
    Role.RISK: "/review-queue",
    Role.MANAGEMENT: "/management",
    Role.ADMIN: "/admin",
}


def landing_path(role: Role) -> str:
    """Return the single canonical frontend landing path for a database role."""
    return ROLE_LANDING_PATHS[role]
