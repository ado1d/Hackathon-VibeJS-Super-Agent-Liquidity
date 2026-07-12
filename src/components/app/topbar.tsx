"use client";

import { useEffect, useState } from "react";
import { useSaliStore, type ViewKey } from "@/lib/store";
import { ROLES } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  MapPin,
  Clock,
  ShieldCheck,
  Search,
  Maximize2,
  Sun,
  Moon,
  Lock,
} from "lucide-react";
import { TourLauncher } from "@/components/app/guided-tour";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const VIEW_TITLES: Record<ViewKey, { title: string; sub: string }> = {
  command: { title: "Command Center", sub: "Network-wide liquidity & alert overview" },
  liquidity: { title: "Unified Liquidity", sub: "Shared cash + separate provider e-money positions" },
  transactions: { title: "Transaction Explorer", sub: "Raw synthetic transactions with anomaly tags & filtering" },
  anomalies: { title: "Anomaly Review", sub: "Unusual activity — evidence, uncertainty, human review" },
  coordination: { title: "Coordination Center", sub: "Alert routing, ownership, escalation, resolution" },
  audit: { title: "Audit Trail", sub: "Traceable coordination history" },
  simulation: { title: "Simulation Control", sub: "Demo scenarios A · B · C · D" },
  whatif: { title: "What-If Simulator", sub: "Model demand shocks & projected liquidity impact" },
  network: { title: "Network Hotspots", sub: "Area-wise pressure, agent map & nearby support discovery" },
  relationships: { title: "Relationship Graph", sub: "Cross-provider customer network (simulated identifiers)" },
  assistant: { title: "AI Assistant", sub: "Ask about the network in plain language — advisory only" },
};

export function Topbar({
  agents,
  onRefresh,
  refreshing,
}: {
  agents: { id: string; code: string; name: string; area: string; status: string }[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const view = useSaliStore((s) => s.view);
  const role = useSaliStore((s) => s.role);
  const setRole = useSaliStore((s) => s.setRole);
  const activeAgentId = useSaliStore((s) => s.activeAgentId);
  const setActiveAgent = useSaliStore((s) => s.setActiveAgent);
  const connected = useSaliStore((s) => s.connected);
  const lastTickAt = useSaliStore((s) => s.lastTickAt);
  const theme = useSaliStore((s) => s.theme);
  const toggleTheme = useSaliStore((s) => s.toggleTheme);
  const loggedInAgentCode = useSaliStore((s) => s.loggedInAgentCode);

  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const meta = VIEW_TITLES[view];
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 md:px-6 h-16">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">{meta.title}</h1>
            <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3" /> Synthetic data
            </Badge>
          </div>
          <p className="text-[11px] md:text-xs text-muted-foreground truncate">{meta.sub}</p>
        </div>

        {/* Tour launcher + command palette trigger + presentation mode */}
        <TourLauncher />
        <button
          onClick={() => useSaliStore.getState().setPaletteOpen(true)}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Command palette (⌘K)"
        >
          <Search className="w-3 h-3" /> Search
          <kbd className="text-[9px] border border-border rounded px-1 ml-1">⌘K</kbd>
        </button>
        <button
          onClick={() => useSaliStore.getState().setPresentationMode(true)}
          className="hidden md:grid place-items-center w-9 h-9 rounded-md border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Presentation mode (⌘.) — hide sidebar & topbar for clean demo"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Agent selector — hidden for agent role (they ARE the agent) */}
        {loggedInAgentCode && activeAgent ? (
          <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" title="Your outlet (locked)">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">
              <span className="font-mono">{activeAgent.code}</span>{" "}
              <span className="font-medium">{activeAgent.area}</span>
            </span>
            <Lock className="w-3 h-3 shrink-0 opacity-60" />
          </div>
        ) : agents.length > 0 ? (
          <Select value={activeAgentId ?? agents[0]?.id} onValueChange={setActiveAgent}>
            <SelectTrigger className="w-[180px] lg:w-[240px] h-9 bg-muted/40 border-border hidden sm:flex">
              <span className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  <span className="text-muted-foreground">{activeAgent?.code}</span>{" "}
                  <span className="font-medium">{activeAgent?.area}</span>
                </span>
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full", a.status === "active" ? "bg-emerald-400" : "bg-amber-400")} />
                    <span className="text-muted-foreground text-xs">{a.code}</span>
                    <span className="font-medium">{a.area}</span>
                    <span className="text-muted-foreground text-xs truncate">· {a.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {/* Role badge — read-only, must sign out to switch roles */}
        <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-muted/40" title={`Signed in as ${ROLES.find((r) => r.key === role)?.name}. Sign out to switch roles.`}>
          <span className="grid place-items-center w-5 h-5 rounded bg-primary/20 text-primary text-[10px] font-bold">
            {ROLES.find((r) => r.key === role)?.short[0]}
          </span>
          <span className="text-xs font-medium">{ROLES.find((r) => r.key === role)?.short}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="grid place-items-center w-9 h-9 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors"
          title="Toggle dark/light theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="grid place-items-center w-9 h-9 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors"
          title="Refresh now"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </button>

        {/* Connection + clock */}
        <div className="hidden xl:flex items-center gap-3 pl-3 border-l border-border h-9">
          <div className="flex items-center gap-1.5 text-xs">
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className={cn("font-medium", connected ? "text-emerald-300" : "text-rose-300")}>
              {connected ? "Live" : "Offline"}
            </span>
            {connected && lastTickAt && (
              <span className="text-muted-foreground hidden 2xl:inline">
                · tick {Math.round((Date.now() - lastTickAt) / 1000)}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground tnum">
            <Clock className="w-3.5 h-3.5" />
            {now || "—"}
          </div>
        </div>
      </div>
    </header>
  );
}
