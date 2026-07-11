import { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Sparkles, User } from "lucide-react";
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formBusy, setFormBusy] = useState(false);

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

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setFormBusy(true);
    setError("");
    try {
      const result = await login(username, password);
      navigate(result.landing_path, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed");
    } finally {
      setFormBusy(false);
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
          <h2>Sign in</h2>
          <p>Type credentials below, or click a role card for quick access.</p>
        </div>

        {/* Manual login form */}
        <form className="login-form" onSubmit={submitForm}>
          <label className="login-field">
            <span>Username</span>
            <div className="input-wrap">
              <User size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. operations"
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label className="login-field">
            <span>Password</span>
            <div className="input-wrap">
              <KeyRound size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="demo-pass"
                autoComplete="current-password"
                required
              />
            </div>
          </label>
          <button
            type="submit"
            className="button primary"
            disabled={formBusy || !username || !password}
          >
            {formBusy ? "Signing in…" : "Sign in"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className="login-divider">
          <span>or quick-pick a demo role</span>
        </div>

        <div className="account-grid">
          {accounts.map((account) => (
            <button
              key={account.role}
              onClick={() => void enter(account.role)}
              disabled={busy !== null || formBusy}
              className="account-card"
            >
              <span className="account-role">{account.role}</span>
              <span>{account.description}</span>
              <ArrowRight size={18} />
              {busy === account.role && <i>Signing in…</i>}
            </button>
          ))}
        </div>
        <p className="login-hint">
          All demo accounts use the password{" "}
          <code>demo-pass</code>. See <strong>USAGE.md</strong> for the full
          guide.
        </p>
      </section>
    </div>
  );
}
