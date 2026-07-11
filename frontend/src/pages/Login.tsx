import { useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { Role } from "../types";

const accounts: { role: Role; description: string }[] = [
  { role: "agent", description: "Own balances, pressure and support requests" },
  {
    role: "operations",
    description: "Assigned-agent monitoring and coordination",
  },
  { role: "risk", description: "Evidence-led review of escalated patterns" },
  {
    role: "management",
    description: "Aggregate operational readiness summary",
  },
  { role: "admin", description: "Deterministic scenario and demo controls" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState("");
  async function enter(role: Role) {
    setBusy(role);
    setError("");
    try {
      const result = await login(role, "demo-pass");
      navigate(result.landing_path, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="logo-mark">
          <Sparkles />
        </div>
        <span className="eyebrow light">EXPLAINABLE OPERATIONS</span>
        <h1>See pressure before service stops.</h1>
        <p>
          One shared cash reserve. Separate provider balances. Clear evidence
          and a human-owned response.
        </p>
        <div className="trust">
          <ShieldCheck />
          <span>
            All transactions and identities are synthetic. This prototype never
            moves funds or confirms fraud.
          </span>
        </div>
      </section>
      <section className="login-panel">
        <div>
          <span className="eyebrow">DEMO ACCESS</span>
          <h2>Choose a working view</h2>
          <p>Each account is limited by backend-enforced permissions.</p>
        </div>
        <div className="account-grid">
          {accounts.map((account) => (
            <button
              key={account.role}
              onClick={() => void enter(account.role)}
              disabled={busy !== null}
              className="account-card"
            >
              <span className="account-role">{account.role}</span>
              <span>{account.description}</span>
              <ArrowRight size={18} />
              {busy === account.role && <i>Signing in…</i>}
            </button>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
