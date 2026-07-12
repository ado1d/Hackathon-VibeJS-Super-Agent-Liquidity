import {
  Activity,
  AlertOctagon,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Download,
  FlaskConical,
  GitCompare,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Mic,
  Network,
  PauseCircle,
  PlayCircle,
  Radar,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, post } from "../api";
import { useAuth } from "../auth";
import type { Agent, Alert, Forecast, Role } from "../types";

type ViewKey =
  | "command"
  | "liquidity"
  | "transactions"
  | "anomalies"
  | "coordination"
  | "network"
  | "relationships"
  | "whatif"
  | "assistant"
  | "audit"
  | "metrics"
  | "simulation";

interface Page<T> {
  items: T[];
  total: number;
}

interface Transaction {
  id: string;
  provider_id: string;
  transaction_type: string;
  amount: string;
  status: string;
  synthetic_customer_id: string;
  occurred_at: string;
  validation_error: string | null;
}

interface DemoStatus {
  active_scenario: { code: string; label: string } | null;
  available_scenarios: { code: string; label: string }[];
}

interface NearbyAgent {
  id: string;
  code: string;
  name: string;
  area: string;
  distance_km: number;
}

interface RelationshipGraph {
  nodes: { id: string; type: string }[];
  edges: { source: string; target: string; provider_id: string; count: number; total_bdt: string }[];
  synthetic_only: boolean;
}

interface AuditEvent {
  id: string;
  source: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
}

interface AssistantResponse {
  ok: boolean;
  answer: string;
  source: "openai" | "deterministic_fallback";
  model: string | null;
  prompt_version: string;
  context: { open_alerts: number; active_agents: number };
}

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboard; shortcut: string }[] = [
  { key: "command", label: "Command Center", icon: LayoutDashboard, shortcut: "g c" },
  { key: "liquidity", label: "Unified Liquidity", icon: Waves, shortcut: "g l" },
  { key: "transactions", label: "Transactions", icon: Receipt, shortcut: "g t" },
  { key: "anomalies", label: "Anomaly Review", icon: AlertOctagon, shortcut: "g a" },
  { key: "coordination", label: "Coordination", icon: ClipboardList, shortcut: "g o" },
  { key: "network", label: "Network Hotspots", icon: MapPin, shortcut: "g n" },
  { key: "relationships", label: "Relationship Graph", icon: Network, shortcut: "g r" },
  { key: "whatif", label: "What-If Simulator", icon: GitCompare, shortcut: "g w" },
  { key: "assistant", label: "AI Assistant", icon: Bot, shortcut: "g i" },
  { key: "audit", label: "Audit Trail", icon: History, shortcut: "g h" },
  { key: "metrics", label: "Metrics", icon: BarChart3, shortcut: "g m" },
  { key: "simulation", label: "Simulation", icon: FlaskConical, shortcut: "g s" },
];

const SCENARIOS = [
  { code: "A", label: "Hidden provider shortage" },
  { code: "B", label: "Cash pressure + unusual activity" },
  { code: "C", label: "Stale and conflicting feeds" },
  { code: "D", label: "Coordinated response" },
];

const ROLE_COPY: Record<Role, string> = {
  agent: "Own outlet support",
  operations: "Field operations",
  risk: "Risk review",
  management: "Aggregate oversight",
  admin: "Demo control",
};

const ROLE_VIEWS: Record<Role, ViewKey[]> = {
  agent: ["command", "liquidity", "transactions", "anomalies", "coordination", "assistant"],
  operations: [
    "command",
    "liquidity",
    "transactions",
    "anomalies",
    "coordination",
    "network",
    "relationships",
    "whatif",
    "assistant",
    "audit",
    "metrics",
    "simulation",
  ],
  risk: ["command", "transactions", "anomalies", "coordination", "relationships", "assistant", "audit"],
  management: ["command", "network", "assistant", "audit", "metrics"],
  admin: NAV.map((item) => item.key),
};

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function pct(value: string | number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "n/a";
  return `${Math.round(Number(value) * 100)}%`;
}

function minutes(value: string | number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No precise ETA";
  const n = Number(value);
  if (n < 60) return `${Math.round(n)} min`;
  return `${(n / 60).toFixed(1)} h`;
}

function severityRank(severity: string) {
  return { critical: 0, high: 1, medium: 2, watch: 3, data_issue: 4 }[severity] ?? 5;
}

export function SaliWorkspace() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewKey>("command");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const allowedViews = useMemo(() => ROLE_VIEWS[user?.role ?? "operations"], [user?.role]);
  const allowedNav = useMemo(
    () => NAV.filter((item) => allowedViews.includes(item.key)),
    [allowedViews],
  );

  const agents = useQuery({
    queryKey: ["sali-agents"],
    queryFn: () => api<Page<Agent>>("/agents?page_size=100"),
  });
  const alerts = useQuery({
    queryKey: ["sali-alerts"],
    queryFn: () => api<Page<Alert>>("/alerts?page_size=100"),
    enabled: user?.role !== "management",
  });
  const demo = useQuery({
    queryKey: ["sali-demo-status"],
    queryFn: () => api<DemoStatus>("/demo/status"),
  });

  const agentItems = agents.data?.items;
  const alertItems = alerts.data?.items;
  const agentList = useMemo(() => agentItems ?? [], [agentItems]);
  const alertList = useMemo(() => alertItems ?? [], [alertItems]);
  const selectedAgent = agentList.find((agent) => agent.id === selectedAgentId) ?? agentList[0];

  useEffect(() => {
    if (!selectedAgentId && agentList[0]) setSelectedAgentId(agentList[0].id);
  }, [agentList, selectedAgentId]);

  useEffect(() => {
    let pendingG = false;
    let timer: number | undefined;
    const shortcuts: Record<string, ViewKey> = {
      c: "command",
      l: "liquidity",
      t: "transactions",
      a: "anomalies",
      o: "coordination",
      n: "network",
      r: "relationships",
      w: "whatif",
      i: "assistant",
      h: "audit",
      m: "metrics",
      s: "simulation",
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (event.key.toLowerCase() === "g") {
        pendingG = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          pendingG = false;
        }, 900);
        return;
      }
      if (pendingG) {
        const next = shortcuts[event.key.toLowerCase()];
        if (next) {
          event.preventDefault();
          setView(next);
        }
        pendingG = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!allowedViews.includes(view)) setView("command");
  }, [allowedViews, view]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sali-agents"] });
    queryClient.invalidateQueries({ queryKey: ["sali-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["sali-demo-status"] });
    queryClient.invalidateQueries({ queryKey: ["sali-detail"] });
    queryClient.invalidateQueries({ queryKey: ["sali-metrics"] });
    toast.success("Synthetic workspace refreshed");
  };

  const title = NAV.find((item) => item.key === view)?.label ?? "SALI";
  const openAlerts = alertList.filter((alert) => alert.status !== "resolved");
  const critical = openAlerts.filter((alert) => ["critical", "high"].includes(alert.severity));

  return (
    <div className="sali-shell">
      <aside className="sali-sidebar">
        <div className="sali-brand">
          <Radar size={28} />
          <div>
            <strong>SALI</strong>
            <span>Liquidity and risk intelligence</span>
          </div>
        </div>
        <nav className="sali-nav" aria-label="SALI workspace navigation">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={view === item.key ? "active" : ""}
                onClick={() => setView(item.key)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                <kbd>{item.shortcut}</kbd>
              </button>
            );
          })}
        </nav>
        <div className="sali-safe-note">
          <ShieldAlert size={16} />
          <span>Synthetic data only. No blocking, freezing, accusation, or money movement.</span>
        </div>
      </aside>

      <main className="sali-main">
        <header className="sali-topbar">
          <div>
            <span className="eyebrow">{ROLE_COPY[user?.role ?? "operations"]}</span>
            <h1>{title}</h1>
          </div>
          <div className="sali-top-actions">
            <span className="sali-scenario">
              {demo.data?.active_scenario
                ? `Scenario ${demo.data.active_scenario.code}: ${demo.data.active_scenario.label}`
                : "No scenario active"}
            </span>
            <button className="button ghost" onClick={() => setCommandOpen(true)}>
              <Search size={16} />
              Command
            </button>
            <button className="button ghost" onClick={() => setTour((value) => !value)}>
              {tour ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
              Demo mode
            </button>
            <button className="button ghost" onClick={refreshAll}>
              <RefreshCw size={16} />
              Refresh
            </button>
            <button className="button ghost" onClick={logout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        {tour && <GuidedTourBanner view={view} setView={setView} allowedNav={allowedNav} />}

        <section className="sali-kpi-strip">
          <Kpi label="Active agents" value={agentList.length} detail="Synthetic outlets" />
          <Kpi label="Open alerts" value={openAlerts.length} detail={`${critical.length} high priority`} />
          <Kpi
            label="Shared cash"
            value={money(agentList.reduce((sum, agent) => sum + Number(agent.balances.cash ?? 0), 0))}
            detail="Never merged with providers"
          />
          <Kpi
            label="Earliest pressure"
            value={minutes(
              Math.min(
                ...agentList
                  .map((agent) => agent.nearest_shortage_minutes)
                  .filter((item): item is number => item !== null),
              ),
            )}
            detail="Forecasted advisory ETA"
          />
        </section>

        <div className="sali-content">
          {agents.isLoading ? (
            <LoadingState />
          ) : (
            <>
              {view === "command" && (
                <CommandView agents={agentList} alerts={alertList} setView={setView} />
              )}
              {view === "liquidity" && (
                <LiquidityView agent={selectedAgent} setSelectedAgentId={setSelectedAgentId} agents={agentList} />
              )}
              {view === "transactions" && <TransactionsView agent={selectedAgent} />}
              {view === "anomalies" && <AnomalyReview alerts={alertList} />}
              {view === "coordination" && (
                <CoordinationView alerts={alertList} refresh={refreshAll} />
              )}
              {view === "network" && (
                <NetworkView agents={agentList} agent={selectedAgent} setSelectedAgentId={setSelectedAgentId} />
              )}
              {view === "relationships" && <RelationshipsView agent={selectedAgent} />}
              {view === "whatif" && <WhatIfView agent={selectedAgent} />}
              {view === "assistant" && <AssistantView />}
              {view === "audit" && <AuditView />}
              {view === "metrics" && <MetricsView />}
              {view === "simulation" && <SimulationView canAdmin={user?.role === "admin"} refresh={refreshAll} />}
            </>
          )}
        </div>
      </main>

      {commandOpen && (
        <CommandPalette
          allowedNav={allowedNav}
          close={() => setCommandOpen(false)}
          setView={(next) => {
            setView(next);
            setCommandOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="sali-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="sali-panel loading-panel">
      <Loader2 className="spin" />
      Loading synthetic SALI workspace...
    </div>
  );
}

function CommandView({
  agents,
  alerts,
  setView,
}: {
  agents: Agent[];
  alerts: Alert[];
  setView: (view: ViewKey) => void;
}) {
  const sortedAlerts = [...alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const providerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    agents.forEach((agent) => {
      Object.entries(agent.balances.providers).forEach(([code, value]) => {
        totals[code] = (totals[code] ?? 0) + Number(value);
      });
    });
    return Object.entries(totals).map(([provider, value]) => ({ provider, value }));
  }, [agents]);
  return (
    <div className="sali-grid two">
      <section className="sali-panel">
        <PanelTitle icon={Activity} title="Network pulse" sub="Zip-style command center overview" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={providerTotals}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="provider" />
            <YAxis />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {providerTotals.map((_, index) => (
                <Cell key={index} fill={["#10b981", "#3b82f6", "#f59e0b"][index % 3]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="sali-panel">
        <PanelTitle icon={AlertOctagon} title="Live alert feed" sub="Severity sorted queue" />
        <div className="sali-list">
          {sortedAlerts.slice(0, 8).map((alert) => (
            <button key={alert.id} className="sali-list-row" onClick={() => setView("coordination")}>
              <span className={`severity-dot ${alert.severity}`} />
              <div>
                <strong>{alert.summary}</strong>
                <small>{alert.alert_type} - {alert.status} - confidence {pct(alert.confidence)}</small>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="sali-panel wide">
        <PanelTitle icon={Waves} title="Agent pressure board" sub="Shared cash and provider balances remain separate" />
        <div className="sali-agent-grid">
          {agents.map((agent) => (
            <article key={agent.id} className="sali-agent-card">
              <div>
                <strong>{agent.code}</strong>
                <span>{agent.area}</span>
              </div>
              <b>{minutes(agent.nearest_shortage_minutes)}</b>
              <small>Cash {money(agent.balances.cash)} - {agent.alert_count} open alerts</small>
            </article>
          ))}
        </div>
      </section>
      <section className="sali-panel wide role-suggestion">
        <PanelTitle icon={ShieldAlert} title="Role-specific next step" sub="The reference demo changes guidance by role" />
        <p>
          Use your allowed views from the sidebar. Agents see their outlet context, operations coordinate
          the response, risk reviews evidence without declaring wrongdoing, management sees aggregate
          readiness, and admin controls scenarios.
        </p>
      </section>
    </div>
  );
}

function LiquidityView({
  agent,
  agents,
  setSelectedAgentId,
}: {
  agent?: Agent;
  agents: Agent[];
  setSelectedAgentId: (id: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["sali-detail", agent?.id],
    queryFn: () => api<{ forecasts: Forecast[]; providers: { code: string; name: string; balance: string; quality_status: string }[]; shared_cash: { balance: string; quality_status: string } | null }>(`/agents/${agent?.id}/overview`),
    enabled: Boolean(agent),
  });
  const chart = (detail.data?.forecasts ?? []).map((forecast) => ({
    name: forecast.resource_type === "shared_cash" ? "cash" : forecast.provider_id?.slice(0, 4) ?? "provider",
    current: Number(forecast.current_balance),
    buffer: Number(forecast.minimum_buffer),
    eta: forecast.shortage_minutes ? Number(forecast.shortage_minutes) : null,
  }));
  return (
    <div className="sali-grid two">
      <section className="sali-panel">
        <PanelTitle icon={Waves} title="Unified liquidity" sub="One shared cash drawer, separate provider balances" />
        <select className="sali-select" value={agent?.id ?? ""} onChange={(event) => setSelectedAgentId(event.target.value)}>
          {agents.map((item) => (
            <option key={item.id} value={item.id}>{item.code} - {item.area}</option>
          ))}
        </select>
        <div className="balance-cards">
          <article>
            <span>Shared cash</span>
            <strong>{money(detail.data?.shared_cash?.balance ?? agent?.balances.cash)}</strong>
            <small>{detail.data?.shared_cash?.quality_status ?? "latest snapshot"}</small>
          </article>
          {(detail.data?.providers ?? []).map((provider) => (
            <article key={provider.code}>
              <span>{provider.name}</span>
              <strong>{money(provider.balance)}</strong>
              <small>{provider.quality_status}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="sali-panel">
        <PanelTitle icon={BarChart3} title="Shortage projection" sub="Advisory forecast, not an automated action" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="current" stroke="#2563eb" fill="#93c5fd" />
            <Area type="monotone" dataKey="buffer" stroke="#ef4444" fill="#fecaca" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function TransactionsView({ agent }: { agent?: Agent }) {
  const tx = useQuery({
    queryKey: ["sali-transactions", agent?.id],
    queryFn: () => api<Page<Transaction>>(`/agents/${agent?.id}/transactions?page_size=80`),
    enabled: Boolean(agent),
  });
  return (
    <section className="sali-panel">
      <PanelTitle icon={Receipt} title="Transactions" sub="Raw synthetic stream with customer identifiers and statuses" />
      <div className="sali-table-wrap">
        <table className="sali-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Synthetic customer</th>
            </tr>
          </thead>
          <tbody>
            {(tx.data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.occurred_at).toLocaleString()}</td>
                <td>{item.transaction_type.replace("_", " ")}</td>
                <td>{item.status}</td>
                <td>{money(item.amount)}</td>
                <td>{item.synthetic_customer_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnomalyReview({ alerts }: { alerts: Alert[] }) {
  const review = alerts.filter((alert) => !["provider_liquidity", "shared_cash_liquidity"].includes(alert.alert_type));
  return (
    <section className="sali-panel">
      <PanelTitle icon={AlertOctagon} title="Anomaly review" sub="Explainable evidence, uncertainty, and AI advisory entry points" />
      <div className="sali-card-list">
        {review.map((alert) => (
          <article key={alert.id} className="sali-review-card">
            <div>
              <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
              <strong>{alert.summary}</strong>
              <p>{alert.reason}</p>
              <small>{alert.uncertainty_statement}</small>
            </div>
            <pre>{JSON.stringify(alert.evidence, null, 2)}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}

function CoordinationView({ alerts, refresh }: { alerts: Alert[]; refresh: () => void }) {
  const action = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      if (type === "resolve") {
        return post(`/alerts/${id}/resolve`, {
          resolution_code: "reviewed_no_further_action",
          note: "Resolved during SALI workspace demo after human review.",
        });
      }
      if (type === "escalate") {
        return post(`/alerts/${id}/escalate`, {
          assigned_role: "risk",
          note: "Escalated from SALI coordination board for review.",
        });
      }
      return post(`/alerts/${id}/${type}`);
    },
    onSuccess: () => {
      toast.success("Workflow event appended");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action failed"),
  });
  const columns = ["new", "acknowledged", "in_progress", "escalated", "resolved"];
  return (
    <div className="case-board">
      {columns.map((status) => (
        <section className="sali-panel case-column" key={status}>
          <PanelTitle icon={ClipboardList} title={status.replace("_", " ")} sub="Audited workflow state" />
          {alerts.filter((alert) => alert.status === status).map((alert) => (
            <article className="case-card" key={alert.id}>
              <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
              <strong>{alert.summary}</strong>
              <p>{alert.recommended_next_step}</p>
              <div className="case-actions">
                <button onClick={() => action.mutate({ id: alert.id, type: "claim" })}>Claim</button>
                <button onClick={() => action.mutate({ id: alert.id, type: "acknowledge" })}>Ack</button>
                <button onClick={() => action.mutate({ id: alert.id, type: "in-progress" })}>Progress</button>
                <button onClick={() => action.mutate({ id: alert.id, type: "escalate" })}>Escalate</button>
                <button onClick={() => action.mutate({ id: alert.id, type: "resolve" })}>Resolve</button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function NetworkView({
  agents,
  agent,
  setSelectedAgentId,
}: {
  agents: Agent[];
  agent?: Agent;
  setSelectedAgentId: (id: string) => void;
}) {
  const nearby = useQuery({
    queryKey: ["sali-nearby", agent?.id],
    queryFn: () => api<{ agents: NearbyAgent[]; notice: string }>(`/agents/${agent?.id}/nearby`),
    enabled: Boolean(agent),
  });
  const areas = Object.values(
    agents.reduce<Record<string, { area: string; agents: number; alerts: number; earliest: number | null }>>((acc, item) => {
      const row = acc[item.area] ?? { area: item.area, agents: 0, alerts: 0, earliest: null };
      row.agents += 1;
      row.alerts += item.alert_count;
      if (item.nearest_shortage_minutes !== null) {
        row.earliest = row.earliest === null ? item.nearest_shortage_minutes : Math.min(row.earliest, item.nearest_shortage_minutes);
      }
      acc[item.area] = row;
      return acc;
    }, {}),
  );
  return (
    <div className="sali-grid two">
      <section className="sali-panel">
        <PanelTitle icon={MapPin} title="Area hotspots" sub="SVG-style operational map replacement with accessible list" />
        <div className="hotspot-map">
          {areas.map((area, index) => (
            <button key={area.area} style={{ left: `${12 + (index % 4) * 22}%`, top: `${18 + Math.floor(index / 4) * 28}%` }}>
              <span>{area.area}</span>
              <b>{area.alerts}</b>
            </button>
          ))}
        </div>
      </section>
      <section className="sali-panel">
        <PanelTitle icon={Network} title="Nearby support discovery" sub="Approved-support language only" />
        <select className="sali-select" value={agent?.id ?? ""} onChange={(event) => setSelectedAgentId(event.target.value)}>
          {agents.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.area}</option>)}
        </select>
        <div className="sali-list">
          {(nearby.data?.agents ?? []).map((item) => (
            <div className="sali-list-row" key={item.id}>
              <MapPin size={16} />
              <div>
                <strong>{item.code} - {item.area}</strong>
                <small>{item.distance_km} km away. Contact operations for approved support.</small>
              </div>
            </div>
          ))}
        </div>
        <p className="safe-copy">{nearby.data?.notice}</p>
      </section>
    </div>
  );
}

function RelationshipsView({ agent }: { agent?: Agent }) {
  const graph = useQuery({
    queryKey: ["sali-relationships", agent?.id],
    queryFn: () => api<RelationshipGraph>(`/agents/${agent?.id}/relationships`),
    enabled: Boolean(agent),
  });
  const edges = graph.data?.edges ?? [];
  return (
    <section className="sali-panel">
      <PanelTitle icon={Network} title="Relationship graph" sub="Synthetic identifiers only; no real customer identity" />
      <div className="relationship-canvas">
        <div className="graph-node agent-node">{agent?.code ?? "Agent"}</div>
        {edges.slice(0, 18).map((edge, index) => (
          <div className="graph-node" key={`${edge.target}-${index}`}>
            <span>{edge.target}</span>
            <small>{edge.count} tx - {money(edge.total_bdt)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatIfView({ agent }: { agent?: Agent }) {
  const [multiplier, setMultiplier] = useState(1.3);
  const sim = useMutation({
    mutationFn: () => post<{ forecasts: { resource_type: string; shortage_minutes: string | null; severity: string }[]; persisted: boolean }>(`/agents/${agent?.id}/forecast-simulation`, { demand_multiplier: multiplier }),
  });
  const data = sim.data?.forecasts.map((item) => ({
    name: item.resource_type,
    eta: item.shortage_minutes ? Number(item.shortage_minutes) : 360,
  })) ?? [];
  return (
    <section className="sali-panel">
      <PanelTitle icon={GitCompare} title="What-if simulator" sub="Non-persisted forecast shock; no financial action" />
      <div className="preset-row">
        {[1, 1.3, 1.5].map((value) => (
          <button className={multiplier === value ? "active" : ""} key={value} onClick={() => setMultiplier(value)}>
            {value === 1 ? "Normal 1x" : value === 1.3 ? "Salary day +30%" : "Eid +50%"}
          </button>
        ))}
      </div>
      <input type="range" min="1" max="3" step="0.1" value={multiplier} onChange={(event) => setMultiplier(Number(event.target.value))} />
      <button className="button primary" onClick={() => sim.mutate()} disabled={!agent || sim.isPending}>
        Run {multiplier.toFixed(1)}x simulation
      </button>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="eta" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      {sim.data && <p className="safe-copy">Persisted: {String(sim.data.persisted)}. Results are advisory and temporary.</p>}
    </section>
  );
}

function AssistantView() {
  const [question, setQuestion] = useState("What should operations review first?");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const assistant = useMutation({
    mutationFn: async () => {
      const result = await post<AssistantResponse>("/assistant", { question, history: messages.slice(-6) });
      return result;
    },
    onSuccess: (result) => {
      setMessages((items) => [...items, { role: "user", content: question }, { role: "assistant", content: result.answer }]);
      setQuestion("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Assistant failed"),
  });
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };
  const listen = () => {
    type SpeechCtor = new () => { lang: string; start: () => void; onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null };
    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech input is not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => setQuestion(event.results[0][0].transcript);
    recognition.start();
  };
  return (
    <section className="sali-panel assistant-panel">
      <PanelTitle icon={Bot} title="AI assistant" sub="Conversational context, safe fallback, browser voice I/O" />
      <div className="chat-window">
        {messages.length === 0 && <p className="safe-copy">Ask about shortages, unusual activity, scenarios, or coordination. The answer uses synthetic context only.</p>}
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble ${message.role}`}>
            <p>{message.content}</p>
            {message.role === "assistant" && <button onClick={() => speak(message.content)}><Volume2 size={14} /> Speak</button>}
          </div>
        ))}
      </div>
      <div className="assistant-compose">
        <button className="button ghost" onClick={listen}><Mic size={16} /> Voice</button>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="button primary" onClick={() => assistant.mutate()} disabled={!question.trim() || assistant.isPending}>
          {assistant.isPending ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          Ask SALI
        </button>
      </div>
    </section>
  );
}

function AuditView() {
  const audit = useQuery({
    queryKey: ["sali-audit"],
    queryFn: () => api<Page<AuditEvent>>("/audit?limit=100"),
  });
  return (
    <section className="sali-panel">
      <PanelTitle icon={History} title="Audit trail" sub="Global traceability for demo actions and alert workflow" />
      <div className="timeline-list">
        {(audit.data?.items ?? []).map((event) => (
          <article key={event.id}>
            <span>{new Date(event.occurred_at).toLocaleString()}</span>
            <strong>{event.type}</strong>
            <small>{event.source} - {event.entity_type ?? "system"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricsView() {
  const metrics = useQuery({
    queryKey: ["sali-metrics"],
    queryFn: () => api<Record<string, unknown>>("/metrics/validation"),
  });
  const scenarios = useQuery({
    queryKey: ["sali-scenarios"],
    queryFn: () => api<{ items: { code: string; measured_results: Record<string, unknown>; active: boolean }[] }>("/metrics/scenarios"),
  });
  const treemap = Object.entries(metrics.data ?? {})
    .filter(([, value]) => typeof value === "number")
    .slice(0, 8)
    .map(([name, size]) => ({ name, size: Number(size) || 0.01 }));
  return (
    <div className="sali-grid two">
      <section className="sali-panel">
        <PanelTitle icon={BarChart3} title="Metrics and validation" sub="Measured evidence, not hard-coded claims" />
        <ResponsiveContainer width="100%" height={260}>
          <Treemap data={treemap} dataKey="size" nameKey="name" stroke="#fff" fill="#2563eb" />
        </ResponsiveContainer>
      </section>
      <section className="sali-panel">
        <PanelTitle icon={Download} title="Scenario comparison" sub="Active and prior deterministic runs" />
        <div className="sali-list">
          {(scenarios.data?.items ?? []).map((item) => (
            <div className="sali-list-row" key={item.code}>
              <CheckCircle2 size={16} />
              <div>
                <strong>Scenario {item.code} {item.active ? "(active)" : ""}</strong>
                <small>{JSON.stringify(item.measured_results)}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SimulationView({ canAdmin, refresh }: { canAdmin: boolean; refresh: () => void }) {
  const scenario = useMutation({
    mutationFn: (code: string) => post(`/admin/scenarios/${code}/load`),
    onSuccess: () => {
      toast.success("Scenario loaded");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Scenario action failed"),
  });
  const reset = useMutation({
    mutationFn: () => post("/admin/scenarios/reset"),
    onSuccess: () => {
      toast.success("Scenario reset");
      refresh();
    },
  });
  return (
    <section className="sali-panel">
      <PanelTitle icon={FlaskConical} title="Simulation" sub="Trigger demo scenarios A-D and reset the synthetic dataset" />
      {!canAdmin && <p className="safe-copy">Ask an administrator to load or reset a scenario. Non-admin roles can still review the active demo.</p>}
      <div className="scenario-grid">
        {SCENARIOS.map((item) => (
          <button key={item.code} disabled={!canAdmin || scenario.isPending} onClick={() => scenario.mutate(item.code)}>
            <strong>Scenario {item.code}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <button className="button ghost danger" disabled={!canAdmin || reset.isPending} onClick={() => reset.mutate()}>
        Reset demo state
      </button>
    </section>
  );
}

function PanelTitle({ icon: Icon, title, sub }: { icon: typeof Activity; title: string; sub: string }) {
  return (
    <div className="panel-title">
      <Icon size={19} />
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function GuidedTourBanner({
  view,
  setView,
  allowedNav,
}: {
  view: ViewKey;
  setView: (view: ViewKey) => void;
  allowedNav: typeof NAV;
}) {
  const index = Math.max(0, allowedNav.findIndex((item) => item.key === view));
  const next = allowedNav[(index + 1) % allowedNav.length];
  return (
    <div className="tour-banner">
      <Sparkles size={18} />
      <span>Demo mode is on. Current stop: {allowedNav[index]?.label}. Next: {next.label}.</span>
      <button onClick={() => setView(next.key)}>Next stop</button>
    </div>
  );
}

function CommandPalette({
  close,
  setView,
  allowedNav,
}: {
  close: () => void;
  setView: (view: ViewKey) => void;
  allowedNav: typeof NAV;
}) {
  const [query, setQuery] = useState("");
  const items = allowedNav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="command-backdrop" onClick={close}>
      <div className="command-modal" onClick={(event) => event.stopPropagation()}>
        <div className="command-input">
          <Search size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a SALI view..." />
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => setView(item.key)}>
              <Icon size={16} />
              <span>{item.label}</span>
              <kbd>{item.shortcut}</kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
