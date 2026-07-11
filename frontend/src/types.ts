export type Role = "agent" | "operations" | "risk" | "management" | "admin";
export type Severity = "critical" | "high" | "medium" | "watch" | "data_issue";
export type AlertStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "escalated"
  | "resolved"
  | "reopened";

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  permissions: string[];
}
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  landing_path: string;
}
export interface Agent {
  id: string;
  code: string;
  name: string;
  area: string;
  nearest_shortage_minutes: number | null;
  health: string;
  alert_count: number;
  balances: {
    cash: number | null;
    providers: Record<string, number>;
  };
  pressure_points: {
    resource_type: string;
    provider_id: string | null;
    current_balance: number;
    minimum_buffer: number;
    shortage_minutes: number | null;
  }[];
}
export interface Forecast {
  resource_type: string;
  provider_id: string | null;
  current_balance: string;
  minimum_buffer: string;
  net_consumption_per_minute: string;
  shortage_minutes: string | null;
  severity: Severity;
  confidence: string;
  confidence_reasons: string[];
  contributing_factors: Record<string, unknown>;
  reliable: boolean;
  horizon_minutes: number;
}
export interface Alert {
  id: string;
  agent_id: string;
  provider_id: string | null;
  alert_type: string;
  severity: Severity;
  status: AlertStatus;
  summary: string;
  reason: string;
  evidence: Record<string, unknown>;
  confidence: string;
  confidence_reasons: string[];
  data_quality_status: string;
  uncertainty_statement: string;
  recommended_next_step: string;
  assigned_role: Role;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_code: string | null;
}
export interface ProviderBalance {
  id: string;
  code: string;
  name: string;
  color: string;
  balance: string;
  freshness_status: string;
  quality_status: string;
  source_timestamp: string;
  quality_details: Record<string, unknown>;
}
export interface Overview {
  agent: {
    id: string;
    code: string;
    name: string;
    area: string;
    latitude: string;
    longitude: string;
  };
  active_scenario: { code: string; label: string };
  shared_cash: {
    balance: string;
    quality_status: string;
    source_timestamp: string;
  } | null;
  providers: ProviderBalance[];
  forecasts: Forecast[];
  alerts: Alert[];
  data_quality_warning: boolean;
}

export interface AIStatus {
  enabled: boolean;
  model: string | null;
  features: string[];
  core_workflows_available: boolean;
}

export interface AIResponse {
  feature: "translate" | "summarize" | "recommendations";
  source: "openai" | "cache" | "deterministic_fallback";
  cached: boolean;
  model: string;
  prompt_version: string;
  result: Record<string, unknown>;
  uncertainty: string;
}
