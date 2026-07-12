"use client";

import { useEffect, useState } from "react";
import { useSaliStore, type ViewKey } from "@/lib/store";
import { viewsForRole } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
  CornerDownLeft,
  Play,
  RefreshCw,
  LogOut,
} from "lucide-react";

const ALL_VIEWS: { key: ViewKey; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "command", label: "Command Center", icon: LayoutDashboard, desc: "Network overview & live KPIs" },
  { key: "liquidity", label: "Unified Liquidity", icon: Waves, desc: "Cash + per-provider positions & forecast" },
  { key: "transactions", label: "Transactions", icon: Receipt, desc: "Raw transaction explorer & anomaly tags" },
  { key: "anomalies", label: "Anomaly Review", icon: ScanSearch, desc: "Unusual activity with evidence" },
  { key: "coordination", label: "Coordination", icon: Users, desc: "Cases, ownership, escalation" },
  { key: "network", label: "Network Hotspots", icon: MapPin, desc: "Area-wise pressure & nearby-agent support" },
  { key: "relationships", label: "Relationship Graph", icon: Share2, desc: "Cross-provider customer network view" },
  { key: "whatif", label: "What-If Simulator", icon: GitCompare, desc: "Model demand shocks & projected impact" },
  { key: "assistant", label: "AI Assistant", icon: MessageSquare, desc: "Ask about the network in plain language" },
  { key: "audit", label: "Audit Trail", icon: History, desc: "Traceable event history" },
  { key: "simulation", label: "Simulation", icon: FlaskConical, desc: "Demo scenarios A / B / C / D" },
];

export function CommandPalette() {
  const paletteOpen = useSaliStore((s) => s.paletteOpen);
  const setPaletteOpen = useSaliStore((s) => s.setPaletteOpen);
  const setView = useSaliStore((s) => s.setView);
  const role = useSaliStore((s) => s.role);
  const setTourOpen = useSaliStore((s) => s.setTourOpen);
  const setTourStep = useSaliStore((s) => s.setTourStep);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const allowed = viewsForRole(role);
  const views = ALL_VIEWS.filter((v) => allowed.includes(v.key));

  const actions = [
    { key: "tour", label: "Start Guided Tour", icon: Play, desc: "Walk through scenarios A/B/C/D", action: () => { setTourStep(0); setTourOpen(true); setPaletteOpen(false); } },
    { key: "reset", label: "Reset Synthetic Data", icon: RefreshCw, desc: "Re-seed the database", action: () => { fetch("/api/seed?reset=1", { method: "POST" }).then(() => { setPaletteOpen(false); window.location.reload(); }); } },
    { key: "reset-prefs", label: "Reset Preferences", icon: RefreshCw, desc: "Clear localStorage (theme, pinned alerts, role)", action: () => { localStorage.removeItem("sali-store"); setPaletteOpen(false); window.location.reload(); } },
    { key: "logout", label: "Sign Out", icon: LogOut, desc: "Return to the login page", action: () => { useSaliStore.getState().logout(); setPaletteOpen(false); } },
  ];

  const filtered = [
    ...views
      .filter((v) => v.label.toLowerCase().includes(query.toLowerCase()) || v.desc.toLowerCase().includes(query.toLowerCase()))
      .map((v) => ({ type: "view" as const, ...v })),
    ...actions
      .filter((a) => a.label.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase()))
      .map((a) => ({ type: "action" as const, ...a })),
  ];

  // Clamp active to the filtered list length. When the query changes, the
  // filtered list changes; we handle the reset in the onChange handler below.
  const effectiveActive = Math.min(active, Math.max(0, filtered.length - 1));

  function handleQueryChange(v: string) {
    setQuery(v);
    setActive(0);
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
      if (paletteOpen && filtered.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        if (e.key === "Enter") {
          e.preventDefault();
          const item = filtered[effectiveActive];
          if (item) {
            if (item.type === "view") { setView(item.key as ViewKey); setPaletteOpen(false); }
            else { item.action(); }
          }
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, setPaletteOpen, setView, filtered, effectiveActive]);

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 top-[20%] translate-y-0" style={{ transform: "translate(-50%, 0)" }}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search views, actions… (↑↓ to navigate, ↵ to select)"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto scroll-thin p-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No results for "{query}"</div>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === effectiveActive;
            return (
              <button
                key={item.type + "-" + (item.key ?? item.label)}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  if (item.type === "view") { setView(item.key as ViewKey); setPaletteOpen(false); }
                  else { item.action(); }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                  isActive ? "bg-primary/10" : "hover:bg-muted/40"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">{item.label}</div>
                  <div className="text-[10.5px] text-muted-foreground leading-tight">{item.desc}</div>
                </div>
                {item.type === "action" && (
                  <span className="text-[9px] text-muted-foreground border border-border rounded px-1 py-0.5">action</span>
                )}
                {isActive && <CornerDownLeft className="w-3 h-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1">↵</kbd> select</span>
            <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1">esc</kbd> close</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1">⌘K</kbd> toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
