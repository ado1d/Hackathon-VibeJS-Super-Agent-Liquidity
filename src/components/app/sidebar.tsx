"use client";

import { useSaliStore, type ViewKey } from "@/lib/store";
import { ROLES, SAFETY_GUARDRAILS } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Waves,
  ScanSearch,
  Users,
  History,
  FlaskConical,
  ShieldCheck,
  CircleDot,
  GitCompare,
  MapPin,
  Receipt,
  Share2,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { viewsForRole } from "@/lib/config";

const NAV: { key: ViewKey; label: string; icon: React.ElementType; hint: string }[] = [
  { key: "command", label: "Command Center", icon: LayoutDashboard, hint: "Network overview & live KPIs" },
  { key: "liquidity", label: "Unified Liquidity", icon: Waves, hint: "Cash + per-provider positions & forecast" },
  { key: "transactions", label: "Transactions", icon: Receipt, hint: "Raw transaction explorer & anomaly tags" },
  { key: "anomalies", label: "Anomaly Review", icon: ScanSearch, hint: "Unusual activity with evidence" },
  { key: "coordination", label: "Coordination", icon: Users, hint: "Cases, ownership, escalation" },
  { key: "network", label: "Network Hotspots", icon: MapPin, hint: "Area-wise pressure & nearby-agent support" },
  { key: "relationships", label: "Relationship Graph", icon: Share2, hint: "Cross-provider customer network view" },
  { key: "whatif", label: "What-If Simulator", icon: GitCompare, hint: "Model demand shocks & projected impact" },
  { key: "assistant", label: "AI Assistant", icon: MessageSquare, hint: "Ask about the network in plain language" },
  { key: "audit", label: "Audit Trail", icon: History, hint: "Traceable event history" },
  { key: "simulation", label: "Simulation", icon: FlaskConical, hint: "Demo scenarios A / B / C / D" },
];

export function Sidebar() {
  const view = useSaliStore((s) => s.view);
  const setView = useSaliStore((s) => s.setView);
  const role = useSaliStore((s) => s.role);
  const loggedInAgentCode = useSaliStore((s) => s.loggedInAgentCode);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <div className="relative grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-background font-black shadow-lg shadow-emerald-500/20">
          S
          <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-300 live-dot ring-2 ring-sidebar" />
        </div>
        <div className="leading-tight">
          <div className="font-bold tracking-tight">SALI</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Liquidity · Risk
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-1">
        {NAV.filter((item) => viewsForRole(role).includes(item.key)).map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "group w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                active
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", active && "text-primary")} />
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{item.label}</div>
                <div className="text-[11px] text-muted-foreground/80 leading-tight mt-0.5 truncate">
                  {item.hint}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            SAFETY RAILS
          </div>
          <ul className="space-y-1.5">
            {SAFETY_GUARDRAILS.slice(0, 3).map((g, i) => (
              <li key={i} className="text-[10.5px] leading-snug text-muted-foreground flex gap-1.5">
                <CircleDot className="w-2.5 h-2.5 mt-0.5 text-emerald-400/70 shrink-0" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-[10px] text-muted-foreground/70 px-1 leading-snug">
          Signed in as <span className="text-foreground font-medium">{ROLES.find((r) => r.key === role)?.short}</span>
          {loggedInAgentCode && <span className="text-emerald-300"> · {loggedInAgentCode}</span>}.
          <br />Synthetic data only — no real wallets.
        </div>
        <button
          onClick={() => useSaliStore.getState().logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-rose-500/30 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
