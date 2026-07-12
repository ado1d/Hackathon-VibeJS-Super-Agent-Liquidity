import type { ProviderCode, ProviderInfo, RoleInfo } from "./types";

// Brand-aligned (low-saturation) provider palette.
// bKash -> pink/magenta, Nagad -> orange, Rocket -> violet.
// These are kept distinct so provider boundaries are visually obvious.
export const PROVIDERS: Record<ProviderCode, ProviderInfo> = {
  bkash: {
    code: "bkash",
    name: "bKash",
    brandColor: "#E2136E",
    softColor: "#FCE7F0",
    tagline: "Digital Financial Services",
  },
  nagad: {
    code: "nagad",
    name: "Nagad",
    brandColor: "#EC1C24",
    softColor: "#FDE8E9",
    tagline: "Digital Wallet",
  },
  rocket: {
    code: "rocket",
    name: "Rocket",
    brandColor: "#7B2FF7",
    softColor: "#EFE7FE",
    tagline: "Mobile Banking",
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

export function providerByCode(code: string) {
  return PROVIDERS[code as ProviderCode];
}

// User roles with clear operational responsibilities.
// "Operations Team" here is the challenge's general role, NOT any provider's
// official org structure. Each provider keeps its own process & data boundary.
export const ROLES: RoleInfo[] = [
  {
    key: "agent",
    name: "Super Agent (Outlet)",
    short: "Agent",
    persona: "Karim Sheikh — Super Agent, Karwan Bazar outlet",
    responsibilities: [
      "Serves bKash, Nagad, Rocket customers from one cash drawer",
      "Sees unified cash + per-provider e-money position",
      "Acts on safe recommendations only (no cross-provider conversion)",
    ],
    canAcknowledge: true,
    canAssign: false,
    canEscalate: true,
    canResolve: false,
    defaultScope: "agent",
  },
  {
    key: "ops_field",
    name: "Field / Territory Officer",
    short: "Field Ops",
    persona: "Tanvir Ahmed — Field Officer, Dhaka North",
    responsibilities: [
      "First responder — directly contacts assigned agents",
      "Reviews low-balance / unusual-activity alerts at the outlet level",
      "Escalates to Area Manager when authorised support is needed",
    ],
    canAcknowledge: true,
    canAssign: false,
    canEscalate: true,
    canResolve: true,
    defaultScope: "area",
  },
  {
    key: "ops_area",
    name: "Area / Thana Manager",
    short: "Area Ops",
    persona: "Nadia Rahman — Area Manager, Dhaka North",
    responsibilities: [
      "Senior coordinator — assigns cases to field officers",
      "Approves authorised support (e.g., provider refills)",
      "Full network visibility — can resolve or reopen any case",
    ],
    canAcknowledge: true,
    canAssign: true,
    canEscalate: true,
    canResolve: true,
    defaultScope: "area",
  },
  {
    key: "risk",
    name: "Risk / Compliance Analyst",
    short: "Risk",
    persona: "Sadia Karim — Risk Reviewer (does NOT determine fraud)",
    responsibilities: [
      "Reviews unusual activity using evidence & context",
      "Documents human-review boundary and false-positive risk",
      "Does NOT make the final fraud determination",
    ],
    canAcknowledge: true,
    canAssign: false,
    canEscalate: true,
    canResolve: false,
    defaultScope: "network",
  },
  {
    key: "management",
    name: "Management",
    short: "Mgmt",
    persona: "Rezaul Karim — Head of Agent Network",
    responsibilities: [
      "Sees area-level service risk & recurring problems",
      "Reviews overall operational readiness",
      "Reads aggregated KPIs, not individual customer data",
    ],
    canAcknowledge: false,
    canAssign: false,
    canEscalate: false,
    canResolve: false,
    defaultScope: "network",
  },
];

export function roleByKey(key: string) {
  return ROLES.find((r) => r.key === key);
}

// Escalation ladder — a safe, human-reviewed chain. Coordination features may
// notify, assign, escalate, recommend, track — they never bypass provider
// authority or auto-move liquidity.
export const ESCALATION_LADDER: { role: string; label: string }[] = [
  { role: "agent", label: "Super Agent (outlet)" },
  { role: "ops_field", label: "Field / Territory Officer" },
  { role: "ops_area", label: "Area / Thana Manager" },
  { role: "risk", label: "Risk / Compliance Analyst" },
];

// Safety guardrails surfaced throughout the UI.
export const SAFETY_GUARDRAILS: string[] = [
  "An anomaly is NOT proof of fraud — every flag requires human review.",
  "No real interoperability, settlement, or conversion between provider wallets.",
  "No connection to real wallets, balances, customer accounts, or financial infrastructure.",
  "The prototype never auto-blocks, freezes, accuses, or moves funds.",
  "Provider data & authority stay separate — one provider cannot control another.",
  "Low confidence / safe fallback is shown when data is missing, late, or conflicting.",
];

// Role-based view access control. Each role sees a relevant subset of views.
// This makes the demo more realistic — an agent doesn't see the full network
// graph or metrics, while management doesn't drill into individual cases.
import type { ViewKey } from "./store";
export const ROLE_VIEWS: Record<string, ViewKey[]> = {
  agent: ["command", "liquidity", "transactions", "anomalies", "coordination", "assistant"],
  ops_field: ["command", "liquidity", "transactions", "anomalies", "coordination", "network", "assistant", "audit"],
  ops_area: ["command", "liquidity", "transactions", "anomalies", "coordination", "network", "relationships", "whatif", "assistant", "audit", "simulation"],
  risk: ["command", "anomalies", "coordination", "relationships", "transactions", "assistant", "audit"],
  management: ["command", "network", "assistant", "audit"],
};

export function viewsForRole(role: string): ViewKey[] {
  return ROLE_VIEWS[role] ?? ["command"];
}
