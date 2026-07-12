"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useSaliStore } from "@/lib/store";
import { useRealtime } from "./use-realtime";

// Central data hook: fetches everything the active view needs and re-fetches
// whenever the realtime service signals an update. Returns a `refresh` fn.
//
// When an agent is logged in (loggedInAgentCode set), all data is scoped to
// their outlet only — alerts, cases, transactions, and balances are filtered.
// Other roles see network-wide data.
export function useSaliData() {
  const activeAgentId = useSaliStore((s) => s.activeAgentId);
  const role = useSaliStore((s) => s.role);
  const loggedInAgentCode = useSaliStore((s) => s.loggedInAgentCode);
  const setActiveAgent = useSaliStore((s) => s.setActiveAgent);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof api.agents>>["agents"]>([]);
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof api.balances>> | null>(null);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.alerts>>["alerts"]>([]);
  const [cases, setCases] = useState<Awaited<ReturnType<typeof api.cases>>["cases"]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof api.audit>>["events"]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a, al, c, au] = await Promise.all([
        api.dashboard(),
        api.agents(),
        api.alerts(),
        api.cases(),
        api.audit(),
      ]);
      setDashboard(d);
      setAgents(a.agents);

      // If an agent is logged in, scope all data to their outlet only.
      let scopedAlerts = al.alerts;
      let scopedCases = c.cases;
      let scopedAudit = au.events;
      let scopedAgents = a.agents;

      if (loggedInAgentCode) {
        const myAgent = a.agents.find((ag) => ag.code === loggedInAgentCode);
        if (myAgent) {
          // Auto-set activeAgentId to the logged-in agent's outlet
          if (!activeAgentId || activeAgentId !== myAgent.id) {
            setActiveAgent(myAgent.id);
          }
          // Filter alerts/cases/audit to only this agent
          scopedAlerts = al.alerts.filter((al) => al.agent.code === loggedInAgentCode);
          scopedCases = c.cases.filter((c) => c.alert.agent.code === loggedInAgentCode);
          scopedAudit = au.events.filter((e) => e.alert?.agent?.code === loggedInAgentCode);
          // Agents list: only show the logged-in agent
          scopedAgents = [myAgent];
        }
      }

      setAlerts(scopedAlerts);
      setCases(scopedCases);
      setAudit(scopedAudit);
      setAgents(scopedAgents);

      // When an agent is logged in, compute scoped dashboard KPIs from their
      // outlet data instead of using the network-wide API response.
      if (loggedInAgentCode) {
        const myAgent = a.agents.find((ag) => ag.code === loggedInAgentCode);
        if (myAgent) {
          const myAlerts = al.alerts.filter((al) => al.agent.code === loggedInAgentCode);
          const myCases = c.cases.filter((c) => c.alert.agent.code === loggedInAgentCode);
          const myBalances = myAgent.providerBalances ?? [];
          const totalEmoney = myBalances.reduce((s, pb) => s + pb.balance, 0);
          const openAlerts = myAlerts.filter((al) => al.status !== "resolved").length;
          const criticalAlerts = myAlerts.filter((al) => al.status !== "resolved" && (al.severity === "critical" || al.severity === "high")).length;
          const openCases = myCases.filter((c) => c.status !== "resolved").length;
          const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
          const resolvedToday = myCases.filter((c) => c.status === "resolved").length;
          const avgConfidence = myBalances.length > 0 ? myBalances.reduce((s, pb) => s + pb.confidence, 0) / myBalances.length : 0;
          setDashboard({
            activeAgents: myAgent.status === "active" ? 1 : 0,
            degradedAgents: myAgent.status === "active" ? 0 : 1,
            openAlerts,
            criticalAlerts,
            totalCash: myAgent.cashBalance,
            totalEmoney,
            avgConfidence: Number(avgConfidence.toFixed(2)),
            openCases,
            resolvedToday,
          });
        }
      } else {
        setDashboard(d);
      }

      // Fetch balances for the active agent
      const agentId = loggedInAgentCode
        ? a.agents.find((ag) => ag.code === loggedInAgentCode)?.id
        : (activeAgentId ?? a.agents[0]?.id);
      if (agentId) {
        const b = await api.balances(agentId);
        setBalances(b);
      }
    } catch (e) {
      console.error("[useSaliData] refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [activeAgentId, loggedInAgentCode, setActiveAgent]);

  // initial + when agent changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // realtime-driven refresh (debounced)
  const lastRefresh = useRef(0);
  useRealtime(useCallback(() => {
    const now = Date.now();
    setTick((t) => t + 1);
    if (now - lastRefresh.current > 2500) {
      lastRefresh.current = now;
      refresh();
    }
  }, [refresh]));

  return {
    tick,
    loading,
    dashboard,
    agents,
    balances,
    alerts,
    cases,
    audit,
    refresh,
    setBalances,
  };
}
