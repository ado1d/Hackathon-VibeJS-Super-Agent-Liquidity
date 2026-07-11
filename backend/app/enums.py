from enum import StrEnum


class Role(StrEnum):
    AGENT = "agent"
    OPERATIONS = "operations"
    RISK = "risk"
    MANAGEMENT = "management"
    ADMIN = "admin"


class TransactionType(StrEnum):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    ADJUSTMENT = "adjustment"


class TransactionStatus(StrEnum):
    SUCCESS = "success"
    FAILED = "failed"
    QUARANTINED = "quarantined"


class FeedStatus(StrEnum):
    FRESH = "fresh"
    DELAYED = "delayed"
    MISSING = "missing"
    CONFLICTING = "conflicting"


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    WATCH = "watch"
    DATA_ISSUE = "data_issue"


class AlertStatus(StrEnum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    REOPENED = "reopened"


class ResolutionCode(StrEnum):
    SUPPORT_ARRANGED = "support_arranged"
    DEMAND_NORMALIZED = "demand_normalized"
    DATA_CORRECTED = "data_issue_corrected"
    REVIEWED_NO_ACTION = "reviewed_no_further_action"
    EXTERNAL_ESCALATION = "escalated_outside_prototype"
    DUPLICATE = "duplicate_alert"
