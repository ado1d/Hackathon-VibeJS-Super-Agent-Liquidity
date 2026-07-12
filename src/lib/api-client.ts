"use client";

import type {
  DashboardKpi,
  BalanceView,
  LiquidityForecast,
  AiExplanation,
} from "@/lib/types";

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return (await r.json()) as T;
}

async function jpost<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) {
    // Try to extract the error message from the response body
    try {
      const j = await r.json();
      throw new Error(j.error || j.message || `${url} -> ${r.status}`);
    } catch (e: any) {
      if (e instanceof Error && e.message && !e.message.includes(`${r.status}`)) throw e;
      throw new Error(`${url} -> ${r.status}`);
    }
  }
  return (await r.json()) as T;
}

async function jpatch<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return (await r.json()) as T;
}

export const api = {
  dashboard: () => jget<DashboardKpi>("/api/dashboard"),
  balances: (agent?: string | null) => jget(`/api/balances${agent ? `?agent=${agent}` : ""}`),
  transactions: (agent?: string | null, provider?: string, anomaly?: boolean) => {
    const p = new URLSearchParams();
    if (agent) p.set("agent", agent);
    if (provider && provider !== "all") p.set("provider", provider);
    if (anomaly) p.set("anomaly", "1");
    return jget<{ agent: { id: string; code: string; name: string }; transactions: any[] }>(
      `/api/transactions?${p.toString()}`
    );
  },
  alerts: (filter?: { status?: string; severity?: string; type?: string }) => {
    const p = new URLSearchParams();
    if (filter?.status) p.set("status", filter.status);
    if (filter?.severity) p.set("severity", filter.severity);
    if (filter?.type) p.set("type", filter.type);
    return jget<{ alerts: any[] }>(`/api/alerts?${p.toString()}`);
  },
  ackAlert: (id: string, actor: string, role: string, agentCode?: string | null) =>
    jpost(`/api/alerts/${id}/ack`, { actor, role, agentCode }),
  setAlertStatus: (id: string, status: string, actor: string, role: string, note?: string) =>
    jpatch(`/api/alerts/${id}`, { status, actor, role, note }),
  cases: () => jget<{ cases: any[] }>("/api/cases"),
  assignCase: (alertId: string, ownerRole: string, ownerName: string, actor: string, role: string) =>
    jpost("/api/cases", { alertId, ownerRole, ownerName, actor, role }),
  caseEvent: (caseId: string, type: string, actor: string, role: string, note: string, agentCode?: string | null) =>
    jpost(`/api/cases/${caseId}/events`, { type, actor, role, note, agentCode }),
  anomalyScan: () => jpost<{ ok: boolean; newAlerts: any[]; scanned: number }>("/api/anomaly/scan"),
  simulate: (action: string) => jpost<{ ok: boolean }>("/api/simulate", { action }),
  aiExplain: (alertId: string, language: "bn" | "en") =>
    jpost<{ ok: boolean; explanation: AiExplanation }>(`/api/ai/explain`, { alertId, language }),
  agents: () => jget<{ agents: any[] }>("/api/agents"),
  audit: () => jget<{ events: any[] }>("/api/audit"),
  seed: (reset = false) => jpost(`/api/seed${reset ? "?reset=1" : ""}`, {}),
  metrics: () => jget<any>("/api/metrics"),
  whatif: (agentId: string, providerCode: string, demandMultiplier: number, hours: number) =>
    jpost<any>("/api/whatif", { agentId, providerCode, demandMultiplier, hours }),
  network: () => jget<any>("/api/network"),
  relationships: () => jget<any>("/api/relationships"),
  assistant: (question: string, role: string, history?: { role: "user" | "assistant"; content: string }[]) =>
    jpost<{ ok: boolean; answer: string; source: string; context?: any }>("/api/assistant", { question, role, history }),
  customer: (id: string) => jget<any>(`/api/customer/${encodeURIComponent(id)}`),
  loadtest: (requests: number, concurrency: number) =>
    jpost<any>("/api/loadtest", { requests, concurrency }),
};

export type { BalanceView, LiquidityForecast };
