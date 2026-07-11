# How to Use the Super Agent Liquidity Platform

> A practical, step-by-step guide for demo accounts, judges, and operators.

---

## Quick Start (60 seconds)

1. Open the app URL in your browser
2. Sign in with any demo account (see table below) — all use password `demo-pass`
3. If the dashboard is empty, sign in as `admin` and load a scenario (A, B, C, or D)
4. Click any agent row to see their liquidity position
5. Click any alert to see evidence, confidence, and the coordination workflow

---

## Demo Accounts

All accounts use the password **`demo-pass`**.

| Username | Role | What you can see | What you can do |
|---|---|---|---|
| `agent` | Agent | Only your own agent's balances and alerts | Acknowledge your own alerts, request operational support |
| `operations` | Operations | All assigned agents, all alerts | Claim, acknowledge, start progress, escalate, resolve, add notes |
| `risk` | Risk reviewer | Escalated alerts with full evidence | Review, start progress, resolve escalated cases |
| `management` | Management | Aggregate area-level summary, validation metrics | View only — no access to individual alerts |
| `admin` | Admin | Everything + scenario controls | Load scenarios A/B/C/D, reset demo state, import transactions, toggle Isolation Forest |

### How to sign in

**Option 1 — Quick pick (recommended for demos):**
Click one of the 5 role cards on the login page. This auto-fills the username and password.

**Option 2 — Manual login:**
Type the username (e.g. `operations`) and password (`demo-pass`) in the form fields, then click **Sign in**.

---

## Scenarios — What Each One Demonstrates

Sign in as `admin` → go to **Demo control** → click a scenario button.

| Scenario | What it shows | What to look for |
|---|---|---|
| **A** — Hidden provider shortage | Total value looks healthy, but Provider A is about to run out | Open the agent → see Provider A bar is red/short, Provider B is fine. The alert says "Provider A e-money may reach its safety buffer in X minutes" |
| **B** — Cash pressure + unusual activity | Shared cash is falling AND there are repeated near-identical transactions | Two separate alerts: one for cash shortage, one for "repeated near-identical transactions requiring review" |
| **C** — Feed inconsistency | One provider feed is missing, another conflicts with the ledger | Confidence drops to ~50%, precise shortage time is suppressed, alert says "no reliable shortage estimate" |
| **D** — Coordinated response | A high-priority alert is ready for the full workflow | Claim → Acknowledge → Add note → Escalate → Switch to Risk → Start progress → Resolve. Watch the timeline grow. |

### Reset to clean state

On the **Demo control** page (admin only), click **Reset baseline state**. This clears all alerts, forecasts, and transactions, and loads the healthy baseline.

---

## Walkthrough by Role

### Agent role

1. Sign in as `agent`
2. You land on **My liquidity position** — your balances and alerts are shown inline
3. **Shared physical cash** card shows the one reserve that supports all providers
4. **Provider e-money** cards show each provider separately (they are never combined)
5. **My active alerts** shows alerts assigned to you
6. Click any alert to:
   - Read the evidence (why it was flagged)
   - See the confidence score and what reduced it
   - Read the uncertainty statement
   - See the recommended next step
   - **Acknowledge** the alert (button in the Human coordination panel)
   - **Request operational support** (type in the case note box and submit)
7. Click **Open full detail** for the complete agent view with forecasts and nearby agents

### Operations role

1. Sign in as `operations`
2. You land on the **Operations cockpit** — a dashboard of all your assigned agents
3. Top metrics show: agents in scope, critical alerts, open cases, nearest pressure
4. **Agent liquidity map** table — click any agent to drill in
5. **Priority queue** — alerts sorted by severity, click to open
6. For each alert you can:
   - **Claim** — take ownership (only one person can own at a time)
   - **Acknowledge** — confirm you've seen it
   - **Start progress** — mark that work has begun
   - **Escalate** — route to Risk reviewer with a note
   - **Resolve** — close with a resolution code and mandatory note
   - **Reopen** — if resolved prematurely
7. Every action is logged in the **Timeline** at the bottom of the alert

### Risk reviewer role

1. Sign in as `risk`
2. You land on the **Evidence review queue** — only escalated alerts
3. Open an escalated alert to review:
   - The full evidence JSON
   - Confidence reasons
   - Uncertainty statement
   - The operations officer's notes
4. You can **Start progress** and **Resolve** with a resolution code
5. You **cannot** claim or acknowledge (those are operations actions)
6. You **cannot** make a final fraud determination — the language is always "unusual" or "requires review"

### Management role

1. Sign in as `management`
2. You land on **Area readiness** — aggregate view only
3. Click **Open management summary** to see:
   - Areas monitored, agents at risk, open alerts, explanation coverage
   - Area hotspot table (agents and alerts per area)
   - Measured validation evidence (metrics from the active scenario)
4. You **cannot** see individual alerts or customer-level evidence

### Admin role

1. Sign in as `admin`
2. You land on **Demo control** — the scenario laboratory
3. **Load Scenario A/B/C/D** — each button loads a deterministic, reproducible scenario
4. **Reset baseline state** — clears everything and loads the healthy baseline
5. **Scenario comparison** — shows measured results from prior runs
6. To see the operational view, click **Home** in the sidebar — admin sees the full operations cockpit
7. To import test transactions: `POST /api/v1/admin/transactions/import` (documented in the API docs at `/docs`)

---

## AI Features (if enabled)

If `AI_ENABLED=true` and `OPENAI_API_KEY` is set, an **AI-assisted explanation** panel appears on alert detail pages with three buttons:

| Button | What it does |
|---|---|
| **Translate** | Generates a Bengali or Banglish version of the alert (use the language dropdown first to pick bn/banglish) |
| **Summarize** | Turns the structured evidence JSON into a 2-sentence plain-English summary with key evidence points |
| **Advisory steps** | Drafts 3 candidate next steps for the operations officer — human picks one to add as a case note |

### AI safety guarantees

- AI output is **advisory only** — it never blocks, freezes, or accuses
- The system prompt forbids words like "fraud", "block", "freeze", "guilty"
- A post-filter rejects any output containing those words and falls back to a deterministic template
- Every AI call is logged to the audit trail with model, tokens, and cache status
- If OpenAI is unavailable, the app works fully without AI — the panel just doesn't appear

---

## Key Concepts

### Provider separation

- **Shared physical cash** = one pool of banknotes in the agent's drawer
- **Provider A e-money** = digital balance with provider A (e.g. bKash)
- **Provider B e-money** = digital balance with provider B (e.g. Nagad)
- These three are **never combined** into a single total. The dashboard always shows them separately.
- A provider balance cannot be transferred to another provider or to cash without a real transaction.

### Confidence and data quality

Each forecast has a confidence score from 0% to 100%. The score drops when:
- Provider feed is delayed (-20%)
- Provider feed is missing (-45%, precise shortage time suppressed)
- Provider feed conflicts with ledger (-25%, precise shortage time suppressed)
- Fewer than 10 recent transactions (-15%)
- High demand volatility (-10%)
- No baseline available for comparison (-10%)

When confidence is low, the system **suppresses the precise shortage time** and shows "No reliable shortage estimate" instead of a potentially misleading number.

### Alert lifecycle

```
NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
         ↓               ↓              ↑
       ESCALATED ←───────┘         REOPENED
         ↓
     IN_PROGRESS
         ↓
     RESOLVED
```

Every transition is permission-checked and appended to the audit timeline. Resolution requires both a resolution code and a note (minimum 3 characters).

---

## Mobile Usage

- On screens narrower than 768px, the sidebar collapses into a hamburger menu (☰ button in the top-left)
- Tap the menu icon to open navigation
- Tap outside the sidebar or the ✕ button to close it
- Tables scroll horizontally — swipe to see all columns
- Action buttons stack vertically on alert detail pages

---

## Troubleshooting

### "Dashboard is empty"

Sign in as `admin` → go to **Demo control** → click **Load Scenario A** (or B/C/D). The baseline loads automatically on first startup, but if someone reset it, you need to load a scenario.

### "401 Unauthorized"

Your session expired (8 hours). Sign out and sign back in.

### "429 Too Many Requests"

You hit the rate limit (50 API calls per minute, or 5 login attempts per minute). Wait 60 seconds and try again.

### "AI assistance is disabled"

AI is not configured. The app works fine without it — all core workflows (forecasting, alerts, coordination) are rule-based and don't need OpenAI. To enable AI, an admin must set `OPENAI_API_KEY` and `AI_ENABLED=true` in the environment variables.

### "CORS error in browser console"

The frontend origin is not in the backend's `CORS_ORIGINS` list. This is a deployment configuration issue — ask the admin to add your frontend URL to the `CORS_ORIGINS` environment variable.

---

## API Reference

Interactive API docs are available at `/docs` on the backend (e.g. `https://your-backend.onrender.com/docs`). Key endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Sign in with username + password |
| GET | `/api/v1/agents` | List agents in your scope |
| GET | `/api/v1/agents/{id}/overview` | Full agent detail with balances, forecasts, alerts |
| GET | `/api/v1/alerts` | List alerts in your scope |
| GET | `/api/v1/alerts/{id}` | Alert detail with evidence, notes, timeline |
| POST | `/api/v1/alerts/{id}/claim` | Take ownership |
| POST | `/api/v1/alerts/{id}/acknowledge` | Confirm you've seen it |
| POST | `/api/v1/alerts/{id}/escalate` | Route to Risk |
| POST | `/api/v1/alerts/{id}/resolve` | Close with resolution code + note |
| POST | `/api/v1/alerts/{id}/notes` | Add a case note |
| GET | `/api/v1/ai/status` | Check if AI is enabled |
| POST | `/api/v1/alerts/{id}/translate?lang=bn` | AI: translate alert |
| POST | `/api/v1/alerts/{id}/summarize` | AI: summarize evidence |
| POST | `/api/v1/alerts/{id}/recommendations` | AI: draft next steps |
| POST | `/api/v1/admin/scenarios/{A|B|C|D}/load` | Admin: load a scenario |
| GET | `/api/v1/metrics/validation` | Validation metrics |
| GET | `/api/v1/health` | Health check (no auth needed) |

---

## Safety & Limitations

- **Synthetic data only** — no real customer data, no real wallets, no real transactions
- **Advisory only** — the prototype never blocks, freezes, accuses, or moves funds
- **No fraud determination** — alerts say "unusual" or "requires review", never "fraud"
- **Provider boundaries respected** — one provider cannot control another's balance, data, or decisions
- **Human review required** — every high-impact alert must be reviewed by a human before any real-world action
- **Demo credentials** — all accounts use `demo-pass`; do not reuse in production

See `docs/responsible-design.md` and `docs/limitations.md` for the full safety documentation.
