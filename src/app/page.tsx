"use client";

import { useState, useEffect } from "react";
import { useSaliData } from "@/hooks/use-sali-data";
import { useSaliStore } from "@/lib/store";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { Footer } from "@/components/app/footer";
import { CommandCenter } from "@/components/views/command-center";
import { LiquidityView } from "@/components/views/liquidity";
import { AnomalyView } from "@/components/views/anomalies";
import { CoordinationView } from "@/components/views/coordination";
import { AuditView } from "@/components/views/audit";
import { SimulationView } from "@/components/views/simulation";
import { WhatIfView } from "@/components/views/whatif";
import { NetworkView } from "@/components/views/network";
import { TransactionsView } from "@/components/views/transactions";
import { RelationshipsView } from "@/components/views/relationships";
import { AssistantView } from "@/components/views/assistant";
import { viewsForRole } from "@/lib/config";
import { GuidedTour, TourLauncher } from "@/components/app/guided-tour";
import { CommandPalette } from "@/components/app/command-palette";
import { ShortcutsHelp } from "@/components/app/shortcuts-help";
import { LoginPage } from "@/components/app/login-page";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Waves,
  ScanSearch,
  Users,
  History,
  FlaskConical,
  GitCompare,
  MapPin,
  Receipt,
  Share2,
  MessageSquare,
  Minimize2,
} from "lucide-react";

const MOBILE_NAV = [
  { key: "command", label: "Command", icon: LayoutDashboard },
  { key: "liquidity", label: "Liquidity", icon: Waves },
  { key: "transactions", label: "Txns", icon: Receipt },
  { key: "anomalies", label: "Anomaly", icon: ScanSearch },
  { key: "coordination", label: "Cases", icon: Users },
  { key: "network", label: "Map", icon: MapPin },
  { key: "relationships", label: "Graph", icon: Share2 },
  { key: "whatif", label: "What-If", icon: GitCompare },
  { key: "assistant", label: "AI", icon: MessageSquare },
  { key: "audit", label: "Audit", icon: History },
  { key: "simulation", label: "Sim", icon: FlaskConical },
] as const;

const MOBILE_TABS = [
  { key: "command", label: "Home", icon: LayoutDashboard },
  { key: "liquidity", label: "Liquidity", icon: Waves },
  { key: "anomalies", label: "Alerts", icon: ScanSearch },
  { key: "coordination", label: "Cases", icon: Users },
  { key: "assistant", label: "AI", icon: MessageSquare },
] as const;

export default function Home() {
  const { dashboard, agents, balances, alerts, cases, audit, refresh, loading } = useSaliData();
  const view = useSaliStore((s) => s.view);
  const setView = useSaliStore((s) => s.setView);
  const activeAgentId = useSaliStore((s) => s.activeAgentId);
  const role = useSaliStore((s) => s.role);
  const loggedIn = useSaliStore((s) => s.loggedIn);
  const presentationMode = useSaliStore((s) => s.presentationMode);
  const setPresentationMode = useSaliStore((s) => s.setPresentationMode);
  useKeyboardShortcuts();

  // Wait for Zustand persist to hydrate from localStorage before rendering.
  // This prevents the login page from flashing on reload when already logged in.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // setHydrated marks that the client has mounted and localStorage is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // Show login page if not authenticated (after hydration)
  if (hydrated && !loggedIn) {
    return <LoginPage />;
  }

  // Show a loading state while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
          Loading SALI…
        </div>
      </div>
    );
  }

  // If the current view isn't allowed for the active role, fall back to command.
  const allowedViews = viewsForRole(role);
  const effectiveView = allowedViews.includes(view as any) ? view : "command";

  if (presentationMode) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
            {loading && !dashboard ? (
              <div className="grid place-items-center h-64 text-muted-foreground text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
                  Loading synthetic network…
                </div>
              </div>
            ) : (
              <>
                {effectiveView === "command" && (
                  <CommandCenter
                    dashboard={dashboard}
                    agents={agents}
                    alerts={alerts}
                    cases={cases}
                    onNavigate={setView}
                  />
                )}
                {effectiveView === "liquidity" && <LiquidityView balances={balances} />}
                {effectiveView === "transactions" && (
                  <TransactionsView agents={agents} activeAgentId={activeAgentId} />
                )}
                {effectiveView === "anomalies" && <AnomalyView alerts={alerts} onMutate={refresh} />}
                {effectiveView === "coordination" && <CoordinationView cases={cases} onMutate={refresh} />}
                {effectiveView === "audit" && <AuditView events={audit} />}
                {effectiveView === "simulation" && <SimulationView onMutate={refresh} />}
                {effectiveView === "whatif" && (
                  <WhatIfView agents={agents} activeAgentId={activeAgentId} />
                )}
                {effectiveView === "network" && <NetworkView agents={agents} />}
                {effectiveView === "relationships" && <RelationshipsView agents={agents} />}
                {effectiveView === "assistant" && <AssistantView />}
              </>
            )}
          </div>
        </main>
        {/* Floating exit-presentation button */}
        <button
          onClick={() => setPresentationMode(false)}
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg text-xs font-medium bg-background/90 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shadow-lg flex items-center gap-1.5"
          title="Exit presentation mode (⌘.)"
        >
          <Minimize2 className="w-3.5 h-3.5" /> Exit presentation
        </button>
        <GuidedTour />
        <CommandPalette />
        <ShortcutsHelp />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            agents={agents.map((a) => ({ id: a.id, code: a.code, name: a.name, area: a.area, status: a.status }))}
            onRefresh={refresh}
            refreshing={loading}
          />
          {/* Mobile nav — horizontal scroll, filtered by role */}
          <div className="md:hidden border-b border-border bg-background/80 backdrop-blur-xl overflow-x-auto scroll-thin">
            <div className="flex items-center gap-1 px-3 py-2 w-max">
              {MOBILE_NAV.filter((n) => allowedViews.includes(n.key as any)).map((n) => {
                const active = effectiveView === n.key;
                const Icon = n.icon;
                return (
                  <button
                    key={n.key}
                    onClick={() => setView(n.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border transition-colors",
                      active ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-transparent"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>

          <main className="flex-1 overflow-y-auto scroll-thin">
            <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
              {loading && !dashboard ? (
                <div className="grid place-items-center h-64 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
                    Loading synthetic network…
                  </div>
                </div>
              ) : (
                <>
                  {effectiveView === "command" && (
                    <CommandCenter
                      dashboard={dashboard}
                      agents={agents}
                      alerts={alerts}
                      cases={cases}
                      onNavigate={setView}
                    />
                  )}
                  {effectiveView === "liquidity" && <LiquidityView balances={balances} />}
                  {effectiveView === "transactions" && (
                    <TransactionsView agents={agents} activeAgentId={activeAgentId} />
                  )}
                  {effectiveView === "anomalies" && <AnomalyView alerts={alerts} onMutate={refresh} />}
                  {effectiveView === "coordination" && <CoordinationView cases={cases} onMutate={refresh} />}
                  {effectiveView === "audit" && <AuditView events={audit} />}
                  {effectiveView === "simulation" && <SimulationView onMutate={refresh} />}
                  {effectiveView === "whatif" && (
                    <WhatIfView agents={agents} activeAgentId={activeAgentId} />
                  )}
                  {effectiveView === "network" && <NetworkView agents={agents} />}
                  {effectiveView === "relationships" && <RelationshipsView agents={agents} />}
                  {effectiveView === "assistant" && <AssistantView />}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      {/* Mobile bottom tab bar — thumb-friendly primary navigation */}
      <div className="md:hidden sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl safe-area-pb">
        <div className="flex items-stretch justify-around px-1 py-1.5">
          {MOBILE_TABS.filter((t) => allowedViews.includes(t.key as any)).map((t) => {
            const active = effectiveView === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key as any)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors min-w-[52px]",
                  active ? "text-primary bg-primary/10" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4", active && "scale-110 transition-transform")} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <Footer />
      <GuidedTour />
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}
