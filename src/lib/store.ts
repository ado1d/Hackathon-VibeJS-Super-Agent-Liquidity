"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RoleKey } from "@/lib/types";

export type ViewKey =
  | "command"
  | "liquidity"
  | "transactions"
  | "anomalies"
  | "coordination"
  | "audit"
  | "simulation"
  | "metrics"
  | "whatif"
  | "network"
  | "relationships"
  | "assistant";

export type ThemeMode = "dark" | "light";

interface SaliState {
  role: RoleKey;
  activeAgentId: string | null;
  view: ViewKey;
  actorName: string;
  connected: boolean;
  lastTickAt: number | null;
  tourOpen: boolean;
  tourStep: number;
  paletteOpen: boolean;
  presentationMode: boolean;
  helpOpen: boolean;
  pinnedAlerts: string[];
  theme: ThemeMode;
  loggedIn: boolean;
  loggedInAgentCode: string | null;
  setRole: (r: RoleKey) => void;
  setActiveAgent: (id: string | null) => void;
  setView: (v: ViewKey) => void;
  setConnected: (c: boolean) => void;
  setLastTick: (t: number) => void;
  setTourOpen: (v: boolean) => void;
  setTourStep: (n: number) => void;
  setPaletteOpen: (v: boolean) => void;
  setPresentationMode: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  togglePin: (alertId: string) => void;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  login: (r: RoleKey, agentCode?: string | null) => void;
  logout: () => void;
}

const ACTOR_BY_ROLE: Record<RoleKey, string> = {
  agent: "Karim Sheikh",
  ops_field: "Tanvir Ahmed",
  ops_area: "Nadia Rahman",
  risk: "Sadia Karim",
  management: "Rezaul Karim",
};

export const useSaliStore = create<SaliState>()(
  persist(
    (set) => ({
      role: "ops_area",
      activeAgentId: null,
      view: "command",
      actorName: ACTOR_BY_ROLE.ops_area,
      connected: false,
      lastTickAt: null,
      tourOpen: false,
      tourStep: 0,
      paletteOpen: false,
      presentationMode: false,
      helpOpen: false,
      pinnedAlerts: [],
      theme: "dark",
      loggedIn: false,
      loggedInAgentCode: null,
      setRole: (r) => set({ role: r, actorName: ACTOR_BY_ROLE[r] }),
      setActiveAgent: (id) => set({ activeAgentId: id }),
      setView: (v) => set({ view: v }),
      setConnected: (c) => set({ connected: c }),
      setLastTick: (t) => set({ lastTickAt: t }),
      setTourOpen: (v) => set({ tourOpen: v }),
      setTourStep: (n) => set({ tourStep: n }),
      setPaletteOpen: (v) => set({ paletteOpen: v }),
      setPresentationMode: (v) => set({ presentationMode: v }),
      setHelpOpen: (v) => set({ helpOpen: v }),
      togglePin: (alertId) => set((s) => ({
        pinnedAlerts: s.pinnedAlerts.includes(alertId)
          ? s.pinnedAlerts.filter((id) => id !== alertId)
          : [...s.pinnedAlerts, alertId],
      })),
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      login: (r, agentCode = null) => set({
        role: r,
        actorName: ACTOR_BY_ROLE[r],
        loggedIn: true,
        loggedInAgentCode: agentCode,
        view: "command",
        activeAgentId: null, // will be resolved from agentCode after agents load
      }),
      logout: () => set({ loggedIn: false, loggedInAgentCode: null, view: "command", activeAgentId: null }),
    }),
    {
      name: "sali-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist selected fields (not transient UI state like connected/paletteOpen)
      partialize: (state) => ({
        pinnedAlerts: state.pinnedAlerts,
        theme: state.theme,
        role: state.role,
        activeAgentId: state.activeAgentId,
        loggedIn: state.loggedIn,
        loggedInAgentCode: state.loggedInAgentCode,
      }),
    }
  )
);

export const ROLE_ACTORS = ACTOR_BY_ROLE;
