"use client";

import { useState, useEffect } from "react";
import { useSaliStore } from "@/lib/store";
import { ROLES } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/types";
import {
  ShieldCheck,
  ChevronRight,
  Store,
  MapPin,
  Eye,
  BarChart3,
  Users,
  Lock,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const ROLE_ICONS: Record<RoleKey, React.ElementType> = {
  agent: Store,
  ops_field: MapPin,
  ops_area: Users,
  risk: Eye,
  management: BarChart3,
};

const ROLE_TONES: Record<RoleKey, { border: string; bg: string; text: string; icon: string }> = {
  agent: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-300", icon: "bg-emerald-500/15 text-emerald-300" },
  ops_field: { border: "border-sky-500/30", bg: "bg-sky-500/5", text: "text-sky-300", icon: "bg-sky-500/15 text-sky-300" },
  ops_area: { border: "border-violet-500/30", bg: "bg-violet-500/5", text: "text-violet-300", icon: "bg-violet-500/15 text-violet-300" },
  risk: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-300", icon: "bg-amber-500/15 text-amber-300" },
  management: { border: "border-rose-500/30", bg: "bg-rose-500/5", text: "text-rose-300", icon: "bg-rose-500/15 text-rose-300" },
};

interface OutletInfo {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  area: string;
  thana: string;
  status: string;
}

export function LoginPage() {
  const login = useSaliStore((s) => s.login);
  const [selected, setSelected] = useState<RoleKey | null>(null);
  const [outletStep, setOutletStep] = useState(false);
  const [outlets, setOutlets] = useState<OutletInfo[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string | null>(null);

  // Fetch outlets when agent role is selected and outlet step is shown
  useEffect(() => {
    if (selected === "agent" && outletStep && outlets.length === 0) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then((d) => setOutlets(d.agents))
        .catch(() => {});
    }
  }, [selected, outletStep, outlets.length]);

  function handleLogin(role: RoleKey, agentCode?: string | null) {
    login(role, agentCode ?? null);
  }

  function handleRoleSelect(role: RoleKey) {
    setSelected(role);
    if (role === "agent") {
      setOutletStep(true);
    } else {
      // Non-agent roles: go straight to login
      setOutletStep(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background decorative gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Top brand bar */}
      <header className="relative z-10 flex items-center justify-between px-6 h-16 border-b border-border/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-background font-black shadow-lg shadow-emerald-500/20">
            S
            <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-300 live-dot ring-2 ring-background" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight">SALI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Liquidity · Risk
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Synthetic data only · No real wallets
        </div>
      </header>

      {/* Main login area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {/* Heading */}
          <div className="text-center mb-8 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-medium mb-4">
              <Sparkles className="w-3 h-3" />
              Codex Community Hackathon · bKash × SUST CSE Carnival 2026
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">
              Super Agent Liquidity & Risk Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto leading-relaxed">
              {outletStep
                ? "Select your outlet to sign in. You'll see only your outlet's liquidity, transactions, and alerts."
                : "Select your role to sign in. Each role sees a different, scoped view of the synthetic multi-provider network."}
            </p>
          </div>

          {/* Outlet selection step (agent only) */}
          {outletStep && selected === "agent" ? (
            <div className="fade-up">
              <button
                onClick={() => { setOutletStep(false); setSelectedOutlet(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to role selection
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                {outlets.map((o, i) => {
                  const isSel = selectedOutlet === o.code;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOutlet(o.code)}
                      className={cn(
                        "text-left rounded-xl border p-3.5 transition-all fade-up",
                        isSel
                          ? "border-emerald-500/40 bg-emerald-500/5 ring-2 ring-primary/30"
                          : "border-border bg-card/40 hover:bg-card/70"
                      )}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn("grid place-items-center w-9 h-9 rounded-lg", isSel ? "bg-emerald-500/15 text-emerald-300" : "bg-muted/40 text-muted-foreground")}>
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{o.name}</span>
                            <span className={cn("text-[9px] px-1 py-0.5 rounded border", o.status === "active" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : "border-amber-500/30 text-amber-300 bg-amber-500/10")}>
                              {o.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            <span className="font-mono">{o.code}</span> · {o.area} · {o.ownerName}
                          </div>
                        </div>
                        {isSel && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => selectedOutlet && handleLogin("agent", selectedOutlet)}
                  disabled={!selectedOutlet}
                  className={cn(
                    "w-full max-w-xs px-6 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                    selectedOutlet
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                      : "bg-muted/40 text-muted-foreground border border-border cursor-not-allowed"
                  )}
                >
                  {selectedOutlet
                    ? <>Sign in as {outlets.find((o) => o.code === selectedOutlet)?.code} <ChevronRight className="w-4 h-4" /></>
                    : "Select an outlet to continue"}
                </button>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  You'll only see data for your outlet. Other agents' data stays separate.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Role selection grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {ROLES.map((r, i) => {
                  const Icon = ROLE_ICONS[r.key];
                  const tone = ROLE_TONES[r.key];
                  const isSel = selected === r.key && !outletStep;
                  return (
                    <button
                      key={r.key}
                      onClick={() => handleRoleSelect(r.key)}
                      className={cn(
                        "text-left rounded-xl border p-4 transition-all fade-up",
                        isSel
                          ? cn(tone.border, tone.bg, "ring-2 ring-primary/30 scale-[1.02]")
                          : "border-border bg-card/40 hover:bg-card/70 hover:border-primary/20"
                      )}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("grid place-items-center w-10 h-10 rounded-lg", tone.icon)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-tight">{r.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.short}</div>
                        </div>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-2">{r.persona}</p>
                      <div className="flex flex-wrap gap-1">
                        {r.responsibilities.slice(0, 2).map((resp, j) => (
                          <span key={j} className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground">
                            {resp.length > 40 ? resp.slice(0, 37) + "…" : resp}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-muted-foreground">
                        <Lock className="w-2.5 h-2.5" />
                        <span>
                          {r.key === "agent" ? "Sees only own outlet" :
                           r.canResolve ? "Can resolve cases" :
                           r.canEscalate ? "Can escalate" :
                           r.canAcknowledge ? "Can acknowledge" : "Read-only access"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Login button for non-agent roles */}
              {selected && selected !== "agent" && !outletStep && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => handleLogin(selected)}
                    className="w-full max-w-xs px-6 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02]"
                  >
                    Sign in as {ROLES.find((r) => r.key === selected)?.short}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Quick login shortcuts */}
              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <span>Quick login (ops roles):</span>
                {ROLES.filter((r) => r.key !== "agent").map((r) => (
                  <button
                    key={r.key}
                    onClick={() => handleLogin(r.key)}
                    className="px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    {r.short}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Synthetic prototype — no real credentials. Agent role requires outlet selection.
              </p>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 px-6 py-3 text-center text-[10px] text-muted-foreground">
        SALI · Decision-support platform for multi-provider super agents (bKash, Nagad, Rocket) · All data is synthetic
      </footer>
    </div>
  );
}
