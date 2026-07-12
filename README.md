# SALI — Super Agent Liquidity & Risk Intelligence Platform

> **Codex Community Hackathon · bKash presents SUST CSE Carnival 2026**

A simple decision-support tool for MFS "super agents" who serve **bKash, Nagad, and Rocket** customers from one shared cash drawer but three separate e-money balances.

SALI helps agents answer one question:
> *"Will I have enough cash and provider balance to keep serving customers for the next few hours?"*

It does this by:
- showing cash + all 3 provider balances in one view (never merged)
- forecasting shortages before they happen
- flagging unusual activity with plain-language evidence (never declared as fraud)
- routing alerts to the right human owner with a traceable coordination trail

> ⚠️ **All data is synthetic.** No real customer, agent, or account is referenced. The prototype never executes real financial transactions.

---

## Table of Contents
1. [What Judges Should See](#-what-judges-should-see)
2. [Source Repository & Setup](#-source-repository--setup)
3. [Architecture Diagram](#-architecture-diagram)
4. [Data & Simulation Note](#-data--simulation-note)
5. [Validation Evidence (Measured Metrics)](#-validation-evidence-measured-metrics)
6. [Responsible-Design Note](#-responsible-design-note)
7. [Sample Data & Environment](#-sample-data--environment)
8. [Demo Scenarios](#-demo-scenarios)
9. [Tech Stack](#-tech-stack)

---

## 🎯 What Judges Should See

This is a **working prototype**. When the app loads, you see a live flow of:

1. **Multi-provider liquidity** — physical cash + 3 separate e-money balances (bKash · Nagad · Rocket) for 6 Dhaka-area outlets.
2. **Forecasted shortage** — a 60-minute projection chart showing when a balance is expected to cross the 20% "running low" threshold (with confidence level).
3. **Anomaly alert** — an explainable alert (e.g. "repeated near-identical amounts from a small customer group") with evidence: facts, sample transactions, and a safe next step.
4. **One coordinated case** — an alert routed → acknowledged → escalated → resolved, with a complete audit trail.

Open the **Coordination** view to see the case board. Open the **Audit Trail** view to see every event in time order.

### How to demo in 90 seconds
1. Open the app at `http://localhost:81`.
2. Click **Simulation** → **Scenario B** (liquidity draining + unusual activity).
3. Watch the **Command Center** update with new KPIs and a red alert.
4. Click the alert → it opens in **Anomaly Review** with evidence + AI advisory.
5. Click **Acknowledge** → **Escalate** → **Resolve** to complete the coordination flow.
6. Open **Audit Trail** to confirm every action is logged.

---

## 📦 Source Repository & Setup

### Prerequisites
- **Bun** ≥ 1.3 (or Node.js ≥ 20 as fallback)
- **Caddy** (for the port-81 gateway on Windows)
- ~500 MB free disk space

### One-time setup
```bash
# 1. Install dependencies
bun install

# 2. Push the Prisma schema to SQLite
bun run db:push

# 3. Start the dev server (Next.js on :3000)
bun run dev

# 4. In a second terminal — start the realtime mini-service (Socket.io on :3001)
cd mini-services/realtime
bun install
bun run dev
```

### Optional: Caddy gateway (port 81)
The repo includes a `Caddyfile` that proxies port 81 → Next.js + Socket.io for production:
```bash
caddy run --config Caddyfile
```

The app will then be available at **`http://localhost:81`**.

### Seed sample data
On first run, the seed script automatically inserts:
- 6 super-agent outlets (Karwan Bazar, Gulshan, Dhanmondi, Mirpur, Mohammadpur, Uttara)
- 60 minutes of balance history per outlet per provider
- ~500 synthetic transactions
- 4 demo scenarios (A · B · C · D)

To re-seed manually:
```bash
curl -X POST http://localhost:3000/api/seed
```

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Users & Roles (role-gated actions)                                  │
│  • Super Agent   • Field Officer   • Area Manager                  │
│  • Risk Analyst  • Management                                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ role-gated actions
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend — Next.js 16 (single route, 12 views)                      │
│  Command Center · Unified Liquidity · Anomaly Review · Coordination │
│  What-If · AI Assistant · Audit Trail · Metrics · Simulation ...   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API (no server actions)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend — Next.js API Routes                                        │
│  • Liquidity Forecast (burn-rate → ETA)                            │
│  • Anomaly Detectors (repeated · velocity · data conflict)          │
│  • Case Workflow (route · ack · escalate · resolve)                │
│  • AI Explain (Bengali + English, safe fallback)                   │
│  • AI Assistant (conversational, live context)                     │
│  • TTS (voice output)                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ reads / writes (synthetic data)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Data & Realtime                                                     │
│  • Prisma + SQLite (agents · balances · txns · alerts · cases)      │
│  • Socket.io on :3001 (auto-tick every 9s, auto-scan every 35s)    │
│  • 3 logical providers — bKash · Nagad · Rocket (separate boundaries)│
└─────────────────────────────────────────────────────────────────────┘
```

### Key interfaces
| Layer | Path | Purpose |
|-------|------|---------|
| Web app | `/` | Single-route Next.js app with 12 views |
| API | `POST /api/simulate` | Manual tick or trigger scenario |
| API | `GET /api/dashboard` | Network-wide KPIs |
| API | `GET /api/balances` | Unified cash + provider balances |
| API | `GET /api/anomaly` | Latest anomaly alerts with evidence |
| API | `POST /api/cases` | Create / ack / escalate / resolve a case |
| API | `GET /api/audit` | Global event timeline |
| Realtime | `ws://localhost:3001` | Socket.io tick + scan events |

### Alert coordination flow
```
Alert created (auto-detector OR manual)
        │
        ▼
Route to owner (based on role + outlet)
        │
        ▼
Acknowledge (human required)
        │
        ▼
Escalate (if severity = high/critical OR stale > X min)
        │
        ▼
Resolve (human closes the loop with a note)
        │
        ▼
Audit Trail (every event timestamped + role + actor)
```

---

## 🧪 Data & Simulation Note

### What is synthetic
- All 6 outlets are **real Dhaka area names** but contain **fictional agent IDs, phone numbers, and transaction records**.
- All phone numbers, customer IDs, and amounts are randomly generated.
- No real PII, credentials, PINs, or OTPs are present in any database row.

### How the data was created
- **Balances**: seeded with realistic per-provider capacity (bKash 500K, Nagad 300K, Rocket 200K BDT) plus 60 minutes of 5-minute snapshots generated by a stochastic burn-rate model.
- **Transactions**: ~500 synthetic cash-in / cash-out / transfer events distributed across the 6 outlets and 3 providers, with realistic time-of-day peaks (lunch hours, end-of-day).
- **Anomalies**: 4 scenarios are injected on seed (see below).

### The 4 demo scenarios
| Scenario | What it demonstrates | How it's triggered |
|----------|---------------------|-------------------|
| **A — Hidden Provider Shortage** | Aggregate looks healthy, but one provider's e-money is about to run out | `POST /api/simulate {"scenario":"A"}` |
| **B — Liquidity + Unusual Activity** | Cash draining fast + repeated near-identical amounts from a small customer group | `POST /api/simulate {"scenario":"B"}` |
| **C — Data Inconsistency** | Provider feed delayed/conflicting → confidence reduced, no confident recommendation | `POST /api/simulate {"scenario":"C"}` |
| **D — Coordinated Response** | Alert routed, acknowledged, escalated, resolved with full audit trail | `POST /api/simulate {"scenario":"D"}` |

### Drift over time
The realtime engine auto-ticks every **~9 seconds** (advances simulation time) and auto-scans every **~35 seconds** (runs all detectors). So the dashboard reflects live drifting state without any manual intervention.

### Assumptions & limitations
- This is a **prototype**, not production. SQLite + single-process Next.js is intentional for portability.
- The forecast uses a simple linear burn rate; in reality, MFS demand is seasonal (Eid, salary days, weekends) — see "False positives" below.
- The "providers" are **logical labels only**. SALI does NOT connect to real bKash / Nagad / Rocket infrastructure.
- AI explanations are advisory and may be wrong; they are always paired with a confidence badge.

---

## 📊 Validation Evidence (Measured Metrics)

At least three measured metrics, run live in-app on the **Metrics & Validation** view.

| # | Category | Metric | Measured Value | How it's measured |
|---|----------|--------|---------------|-------------------|
| 1 | **Analytics** | Anomaly recall | **4 / 4 (100%)** | All 4 injected scenarios (A·B·C·D) are surfaced by detectors |
| 2 | **Analytics** | Shortage lead-time | **~1.5 h avg** | Avg hours before projected balance crosses 20% threshold |
| 3 | **Analytics** | Explanation coverage | **100%** | % of alerts with facts + uncertainty + safe next step |
| 4 | **Performance** | p50 query latency | **~9 ms** | Median across agent lookup, alerts query, txn count |
| 5 | **Reliability** | Feed health | **~94%** | % of provider feeds fresh (not stale) |
| 6 | **Reliability** | Case traceability | **100%** | % of cases with a complete audit-trail row |

### How judges can reproduce
```bash
# Trigger the load test endpoint
curl -X POST http://localhost:3000/api/loadtest \
  -H "Content-Type: application/json" \
  -d '{"requests":100,"concurrency":5}'

# Returns JSON with p50 / p95 / p99 + per-query-type breakdown
```

The **Metrics & Validation** view also includes a built-in load-test panel with sliders for total requests and concurrency — no command line needed.

---

## 🛡️ Responsible-Design Note

### What SALI does (carefully)
- ✅ **Careful language.** Uses "unusual" and "requires review" — never declares fraud.
- ✅ **Human review required.** Every high-impact alert routes to a human owner before any action.
- ✅ **Provider boundaries preserved.** One provider cannot control another's balance, data, or decisions.
- ✅ **Synthetic data only.** No real identities, credentials, PINs, OTPs, or account numbers.
- ✅ **False-positive awareness.** Each detector documents expected FP risk (e.g. Eid bonuses, salary-day spikes).
- ✅ **Low-confidence fallback.** When data is stale or conflicting, confidence drops and no confident recommendation is made.

### What SALI intentionally does NOT do
- ❌ **No real interoperability, settlement, or wallet conversion.** This is a prototype, not a payment rail.
- ❌ **No connection to real wallets or financial infrastructure.**
- ❌ **No automatic blocking, freezing, or disciplinary action.** A human must always decide.
- ❌ **No collection of credentials, PINs, OTPs, or passwords.**
- ❌ **No final fraud determination.** All risk signals are advisory, not conclusive.
- ❌ **No cross-provider data merging.** Each provider stays in its own logical boundary.

### Privacy summary
- All data is generated locally by the seed script.
- No third-party telemetry, analytics, or tracking scripts are loaded.
- The AI assistant sends only anonymized aggregate KPIs to the LLM (never customer IDs or amounts).

---

## 🌱 Sample Data & Environment

### `.env.example`
```bash
# Database
DATABASE_URL="file:./dev.db"

# Realtime service
NEXT_PUBLIC_REALTIME_URL="http://localhost:3001"

# AI provider (optional — fallback is deterministic text)
ZAI_API_KEY="your-key-here"

# App port
PORT=3000
```

### Sample data shape
```jsonc
// GET /api/balances?agentId=agt_karwan_01
{
  "agentId": "agt_karwan_01",
  "agentName": "Karwan Bazar Outlet 01",
  "cash": { "balance": 145000, "capacity": 200000, "trend": "stable" },
  "providers": {
    "bkash":  { "balance": 48000,  "capacity": 500000, "isStale": false },
    "nagad":  { "balance": 275000, "capacity": 300000, "isStale": false },
    "rocket": { "balance": 95000,  "capacity": 200000, "isStale": true  }
  }
}
```

---

## 🎬 Demo Scenarios (one-paragraph each)

- **Scenario A — Hidden Provider Shortage.** The aggregate KPI shows green across the network. But if you drill into one outlet, Rocket's e-money is projected to cross the 20% threshold in 38 minutes. The detector flags this and routes it to the outlet owner. *Watch the Confidence column in the Unified Liquidity view — it should turn amber for Rocket only.*

- **Scenario B — Liquidity + Unusual Activity.** Two things at once: (1) cash is draining at 2× normal rate, and (2) 14 transactions of exactly 4,999 BDT from 4 customers in 20 minutes. The detector tags both. The evidence card shows the 14 sample rows, the fact list, and a "possible normal reasons" note (salary day, vendor payouts). *No "fraud" label — only "unusual."*

- **Scenario C — Data Inconsistency.** The bKash feed goes stale for 90 seconds. The detector still alerts, but the confidence badge drops from "high" to "low," and the AI advisory says: "Recommendation paused — waiting for fresh data." *This is the safe fallback in action.*

- **Scenario D — Coordinated Response.** An alert is created, acknowledged by a Field Officer, escalated to an Area Manager (severity = critical), then resolved with a closing note. The audit trail shows 4 events with actor, role, timestamp, and reason. *Open the Audit Trail view to see the full chain.*

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **Database** | Prisma ORM + SQLite |
| **Realtime** | Socket.io mini-service (port 3001) |
| **Charts** | Recharts |
| **State** | Zustand (client) + TanStack Query patterns |
| **AI** | z-ai-web-dev-sdk (LLM chat, TTS, vision) |
| **Icons** | Lucide React |

---

## 📜 Hackathon Deliverables Checklist

- ✅ **Working prototype** — live multi-provider flow + alert coordination
- ✅ **Source repository** — this README, setup steps, sample data, env examples
- ✅ **Architecture diagram** — see "Architecture Diagram" above
- ✅ **Data & simulation note** — see "Data & Simulation Note" above
- ✅ **Validation evidence** — 6 measured metrics (≥3 required), see "Validation Evidence"
- ✅ **Responsible-design note** — see "Responsible-Design Note" above
- ✅ **Alert case study export** — Markdown, from Coordination view
- ✅ **At least 2 provider contexts** — 3 included (bKash · Nagad · Rocket)
- ✅ **Shared cash + provider-specific balances** — yes
- ✅ **Forward-looking liquidity insight** — yes (60-min forecast)
- ✅ **Anomaly category with evidence** — yes (facts + sample txns + uncertainty)
- ✅ **Human-review & careful risk language** — yes ("unusual" not "fraud")
- ✅ **Alert routing, ownership, ack, escalation, resolution** — yes
- ✅ **Failure / uncertainty / false-positive considerations** — yes (Scenario C)
- ✅ **Safety, privacy, boundaries, limitations stated** — yes

---

*Built for the Codex Community Hackathon · bKash presents SUST CSE Carnival 2026.*
