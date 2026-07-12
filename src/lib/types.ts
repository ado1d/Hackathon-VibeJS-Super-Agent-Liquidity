// Shared domain types for the Super Agent Liquidity & Risk Intelligence Platform.
// All data in this prototype is SYNTHETIC.

export type ProviderCode = "bkash" | "nagad" | "rocket";

export type RoleKey =
  | "agent"
  | "ops_field"
  | "ops_area"
  | "risk"
  | "management";

export type AlertType = "liquidity" | "anomaly" | "data_quality";
export type AlertSeverity = "critical" | "high" | "warning" | "info";
export type AlertStatus =
  | "open"
  | "acknowledged"
  | "owned"
  | "escalated"
  | "resolved";

export type CaseStatus =
  | "open"
  | "acknowledged"
  | "assigned"
  | "escalated"
  | "resolved";

export interface ProviderInfo {
  code: ProviderCode;
  name: string;
  brandColor: string;
  softColor: string;
  tagline: string;
}

export interface RoleInfo {
  key: RoleKey;
  name: string;
  short: string;
  persona: string;
  responsibilities: string[];
  canAcknowledge: boolean;
  canAssign: boolean;
  canEscalate: boolean;
  canResolve: boolean;
  defaultScope: "agent" | "area" | "provider" | "network";
}

export interface LiquidityForecast {
  scope: string; // 'cash' | provider code
  label: string;
  current: number;
  capacity: number;
  burnRatePerHour: number; // net outflow per hour
  hoursToShortage: number | null; // null => not projected to run out
  projectedShortageAt: string | null; // ISO
  confidence: number; // 0..1
  confidenceLabel: "low" | "medium" | "high";
  series: { t: string; balance: number }[];
}

export interface AnomalyEvidence {
  summary: string;
  facts: { label: string; value: string }[];
  sampleTx: { id: string; amount: number; customer: string; time: string }[];
  possibleNormalReasons: string[];
  uncertainty: string;
  safeNextStep: string;
  falsePositiveNote: string;
}

export interface DashboardKpi {
  activeAgents: number;
  degradedAgents: number;
  openAlerts: number;
  criticalAlerts: number;
  totalCash: number;
  totalEmoney: number;
  avgConfidence: number;
  openCases: number;
  resolvedToday: number;
}

export interface AiExplanation {
  situation: string;
  evidence: string;
  uncertainty: string;
  safeNextStep: string;
  language: "bn" | "en";
}

export interface BalanceView {
  provider: ProviderCode | "cash";
  label: string;
  balance: number;
  capacity: number;
  pct: number;
  isStale?: boolean;
  latencyMs?: number;
  confidence?: number;
}
