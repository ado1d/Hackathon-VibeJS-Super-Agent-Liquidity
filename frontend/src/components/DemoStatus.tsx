import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, post } from "../api";
import { useAuth } from "../auth";

interface DemoState {
  active: boolean;
  scenario: { code: string; label: string; seed: number } | null;
  can_load: boolean;
  available_scenarios: { code: string; label: string }[];
}

export function DemoStatus() {
  const { user } = useAuth();
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => api<DemoState>("/demo/status"),
  });
  const load = useMutation({
    mutationFn: (code: string) => post(`/admin/scenarios/${code}/load`),
    onSuccess: () => void client.invalidateQueries(),
  });
  if (!status.data || status.data.active) return null;
  return (
    <div className="demo-empty" role="status">
      {user?.role === "admin" ? (
        <>
          <strong>No scenario is active.</strong>
          <span>Load a deterministic demo:</span>
          {status.data.available_scenarios.map((scenario) => (
            <button
              key={scenario.code}
              className="button ghost"
              disabled={load.isPending}
              title={scenario.label}
              onClick={() => load.mutate(scenario.code)}
            >
              Scenario {scenario.code}
            </button>
          ))}
          <Link to="/admin">Open demo control</Link>
        </>
      ) : (
        <span>Ask an administrator to load a deterministic scenario.</span>
      )}
    </div>
  );
}
