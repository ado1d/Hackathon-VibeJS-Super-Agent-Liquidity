from app.enums import Role


PERMISSIONS: dict[Role, set[str]] = {
    Role.AGENT: {"agent:own", "alert:own:view", "alert:own:acknowledge", "alert:support-request"},
    Role.OPERATIONS: {"agent:assigned", "alert:view", "alert:coordinate", "alert:resolve", "metrics:view"},
    Role.RISK: {"alert:escalated", "alert:review", "alert:resolve", "metrics:view"},
    Role.MANAGEMENT: {"summary:view", "metrics:view"},
    Role.ADMIN: {"*"},
}


def permissions_for(role: Role) -> list[str]:
    return sorted(PERMISSIONS[role])

