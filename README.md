# SALI — Super Agent Liquidity & Risk Intelligence Platform

**Codex Community Hackathon · bKash presents SUST CSE Carnival 2026**

SALI is a safe, explainable decision-support platform for multi-provider mobile financial service super agents. It helps agents and provider operations teams understand **shared cash pressure**, **provider-wise e-money pressure**, **unusual transaction patterns**, and **who should coordinate the response** — without executing real financial transactions, merging provider balances, or declaring fraud.

- **Live demo:** https://sali-project-1.vercel.app/
- **Source repository:** https://github.com/ado1d/sali
- **Prototype mode:** Synthetic/demo data only
- **Core principle:** Detect, explain, coordinate — never accuse, transfer, or control money.

---

## 1. Executive Summary

A mobile financial service super agent may serve customers from multiple providers such as **bKash, Nagad, and Rocket**. The agent usually has:

1. **One shared physical cash drawer** used for customer cash-in/cash-out service.
2. **Separate e-money balances** for each provider.

This creates an operational problem: the agent may appear healthy if all values are viewed together, but service can still fail if either the **shared cash reserve** or a **specific provider balance** becomes low.

SALI solves this by providing a unified but provider-safe operational view, forecasting upcoming pressure, surfacing unusual activity with evidence, and routing important alerts through a human-owned coordination workflow.

---

## 2. What Makes SALI Different

SALI is **not only a dashboard**. A dashboard shows data; SALI creates a safe decision path.

It connects four layers into one workflow:

```text
Liquidity pressure
      +
Unusual activity evidence
      +
Confidence and uncertainty
      +
Human case workflow
      ↓
Safe operational decision support
```

For every important alert, the system explains:

- What is under pressure.
- Why the issue matters.
- Which evidence supports the alert.
- How reliable the data is.
- Who owns the case.
- What the safe next step is.
- Whether the issue is open, acknowledged, escalated, or resolved.

---

## 3. Required Deliverables Coverage

| Required deliverable | What judges should see in SALI |
|---|---|
| **Working prototype** | Live demo showing multi-provider balances, shared cash pressure, unusual activity evidence, and a case workflow from alert to coordination/resolution. |
| **Source repository** | Source code, setup instructions, environment examples, sample synthetic data generation, API routes, and UI modules. |
| **Architecture diagram** | README architecture section plus Metrics & Validation view describing frontend, API routes, Prisma/SQLite, analytics, AI assistance, provider boundaries, and alert flow. |
| **Data and simulation note** | Synthetic data explanation, provider assumptions, scenario A/B/C/D descriptions, anomaly assumptions, and limitations. |
| **Validation evidence** | Metrics route and Metrics & Validation page showing shortage lead time, anomaly scenario coverage, explanation coverage, query latency, feed health, and case traceability. |
| **Responsible-design note** | Safety section explaining privacy, human review, false positives, advisory boundaries, provider separation, and actions the system intentionally does not perform. |
| **Final presentation support** | Demo script, role workflow, limitations, and story-driven explanation included in this README for live presentation. |

---

## 4. Key Product Modules

| Module | Purpose |
|---|---|
| **Command Center** | Network overview, operational KPIs, critical alerts, and overall readiness. |
| **Unified Liquidity** | Shared cash and provider-wise balances shown separately with forecasted pressure. |
| **Transactions** | Raw synthetic transaction explorer with provider, type, amount, status, and anomaly tags. |
| **Anomaly Review** | Evidence-led review of unusual patterns such as repeated amounts, velocity spikes, concentration, and data conflicts. |
| **Coordination** | Human case workflow with ownership, acknowledgement, escalation, notes, and resolution. |
| **Network Hotspots** | Area-wise pressure view and support prioritization. |
| **Relationship Graph** | Simulated cross-provider relationship insight using synthetic identifiers only. |
| **What-If Simulator** | Demand shock simulation for Eid, salary day, local events, or sudden cash-out pressure. |
| **AI Assistant** | Optional explanation, summarization, and advisory support; never a decision maker. |
| **Audit Trail** | Traceable history of alert creation, ownership changes, notes, escalation, and resolution. |
| **Metrics & Validation** | Analytical, performance, reliability, and responsible-design evidence. |
| **Simulation** | Deterministic demo scenarios A/B/C/D and controlled data reset/seed flow. |

---

## 5. User Roles and Workflow

SALI is designed around the actual people involved in a super-agent operation.

| Role | Main responsibility | What the role sees/does |
|---|---|---|
| **Agent / Outlet** | Confirms ground reality | Views own cash, provider balances, pressure, and support need. Confirms whether demand is normal or support is required. |
| **Operations / Field Officer** | Coordinates service continuity | Monitors assigned agents, claims alerts, acknowledges, contacts agent, adds notes, arranges approved support, escalates if needed. |
| **Risk Reviewer** | Reviews unusual evidence | Reviews escalated unusual patterns, evidence, confidence, uncertainty, and operations notes. Does not declare fraud. |
| **Management** | Monitors readiness | Views aggregate area-level risk, hotspots, open/resolved alerts, and validation metrics. Does not inspect sensitive individual evidence. |
| **Admin / Demo Controller** | Controls simulation | Seeds synthetic data, loads scenarios, resets demo state, and demonstrates the end-to-end flow. |

### Human Coordination Flow

```text
System detects liquidity/anomaly/data-quality issue
        ↓
Alert is created with reason, evidence, confidence, uncertainty
        ↓
Operations receives and claims the alert
        ↓
Operations acknowledges and verifies with the agent
        ↓
Case note is added
        ↓
If unusual evidence remains unexplained, case is escalated to Risk
        ↓
Risk reviewer performs evidence-led review
        ↓
Case is resolved with note and audit trail
```

---

## 6. Architecture Overview

```text
Browser / User Interface
  ├─ Command Center
  ├─ Unified Liquidity
  ├─ Transactions
  ├─ Anomaly Review
  ├─ Coordination
  ├─ Audit Trail
  └─ Metrics & Validation
        ↓
Next.js App Router + API Routes
  ├─ /api/dashboard
  ├─ /api/transactions
  ├─ /api/alerts
  ├─ /api/cases
  ├─ /api/anomaly/scan
  ├─ /api/simulate
  ├─ /api/metrics
  ├─ /api/assistant
  └─ /api/seed
        ↓
Service Logic
  ├─ Liquidity forecasting
  ├─ Anomaly detection
  ├─ Confidence and safe fallback
  ├─ Case workflow
  ├─ Audit logging
  └─ Optional AI assistance
        ↓
Prisma ORM + SQLite Demo Database
  ├─ Providers
  ├─ Agents
  ├─ Provider balances
  ├─ Shared cash snapshots
  ├─ Transactions
  ├─ Alerts
  ├─ Cases
  ├─ Case events
  └─ Simulation logs
```

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router + TypeScript |
| UI | React, Tailwind CSS, shadcn/ui style components, Lucide icons |
| Charts | Recharts |
| Data layer | Prisma ORM |
| Demo database | SQLite |
| AI assistance | OpenAI server-side API / safe fallback |
| Deployment | Vercel demo deployment |

---

## 7. Data and Simulation Note

SALI uses **synthetic data only**. No real customer, wallet, provider account, PIN, OTP, password, or production financial data is used.

### Synthetic Data Fields

The demo data includes:

- Agent code, outlet name, area, thana, district, latitude, longitude.
- Provider code and provider-specific e-money balance.
- Shared physical cash balance.
- Transaction type: cash-in, cash-out, transfer-in, transfer-out.
- Amount, timestamp, status, synthetic customer ID.
- Feed quality indicators such as latency, stale status, and confidence.
- Alert type, severity, evidence, confidence, status, case owner, and case timeline.

### Demo Scenarios

| Scenario | Purpose | What it demonstrates |
|---|---|---|
| **Scenario A — Hidden Provider Shortage** | Aggregate looks healthy but one provider balance is under pressure. | Provider-specific liquidity visibility and forward-looking shortage insight. |
| **Scenario B — Liquidity Pressure + Unusual Activity** | Shared cash is falling and repeated near-identical cash-outs appear. | Combined liquidity risk, unusual activity evidence, false-positive awareness, and human review. |
| **Scenario C — Data Inconsistency** | Provider feed is delayed/stale/conflicting. | Confidence reduction, safe fallback, and no misleading recommendation. |
| **Scenario D — Coordinated Response** | A high-priority case is already handled through escalation and resolution. | Ownership, acknowledgement, case notes, escalation, resolution, and audit trail. |

---

## 8. Analytical Approach

### 8.1 Liquidity Forecasting

SALI forecasts whether shared cash or a provider-specific balance may reach a safety threshold.

```text
Available balance = current balance - safety buffer
Net outflow rate  = recent outgoing demand - recent incoming demand
Time to pressure  = available balance / net outflow rate
```

Example:

```text
Shared cash: 14,450 BDT
Safety buffer: 10,000 BDT
Available cash: 4,450 BDT
Recent cash consumption: 559 BDT/min
Estimated time to pressure: about 8 minutes
```

This allows operations teams to intervene before customer service is disrupted.

### 8.2 Anomaly Evidence

SALI does not use anomaly scores as proof of wrongdoing. It surfaces review-worthy evidence such as:

- Repeated near-identical cash-out amounts.
- Sudden transaction velocity spike.
- Concentration among a small group of synthetic identifiers.
- Abnormal failure patterns.
- Provider feed delay or balance inconsistency.
- Cross-provider relationship patterns using synthetic identifiers.

Every anomaly is framed as **unusual activity requiring human review**, not as a final fraud decision.

### 8.3 Confidence and Uncertainty

SALI reduces confidence when data quality is weak:

- Provider feed is delayed.
- Feed is stale or missing.
- Balance appears conflicting.
- Transaction sample is limited.
- Activity is volatile or lacks a reliable baseline.

When confidence is low, the system avoids overconfident recommendations and asks for human verification.

---

## 9. Validation Evidence

SALI includes measurable validation evidence through the Metrics & Validation view and `/api/metrics` endpoint.

| Metric category | Example evidence shown by the system |
|---|---|
| **Shortage lead time** | Forecasted time before provider/shared-cash pressure reaches safety buffer. |
| **Injected scenario coverage** | Demo scenarios A/B/C/D are seeded and surfaced in the interface. |
| **Anomaly evidence coverage** | Alerts include evidence, reason, uncertainty, and a safe next step. |
| **Explanation coverage** | Percentage of alerts with facts, uncertainty, and recommended action. |
| **Performance** | API query timing at demo data volume. |
| **Reliability** | Feed health, stale feed count, average confidence, case traceability. |
| **Auditability** | Percentage of cases with timeline/case events. |

The goal is not to claim production fraud-detection readiness. The goal is to demonstrate measurable analytical quality, reliable fallback behavior, and end-to-end engineering evidence for a safe prototype.

---

## 10. Responsible Design and Safety Boundaries

SALI is designed as a **decision-support prototype**, not as a financial execution system.

### What SALI Does

- Shows provider-wise balances and shared cash separately.
- Forecasts possible liquidity pressure.
- Surfaces unusual activity with evidence and uncertainty.
- Assigns and tracks human-owned cases.
- Supports acknowledgement, escalation, notes, resolution, and audit history.
- Provides advisory explanations and optional AI-assisted summaries.

### What SALI Intentionally Does Not Do

- Does not merge provider balances.
- Does not convert, settle, or transfer balances between providers.
- Does not connect to real wallets or production provider APIs.
- Does not request PINs, OTPs, passwords, private keys, or credentials.
- Does not block users, freeze funds, accuse agents, or initiate financial actions.
- Does not declare fraud or make final risk decisions.
- Does not expose real customer identity.

### Careful Risk Language

SALI uses:

```text
Unusual activity
Requires review
Evidence-led review
Human review required
Approved support coordination
```

SALI avoids:

```text
Fraud confirmed
Block user
Freeze account
Transfer balance
Merge provider balance
Automatic disciplinary action
```

---

## 11. Local Setup

### Prerequisites

- Node.js or Bun
- Git
- Prisma-compatible environment

### Install and Run

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Run development server
npm run dev
```

Open:

```text
http://localhost:3000
```

### Seed Demo Data

The app includes a seed API route. After running locally, open or call:

```text
/api/seed
```

This initializes the synthetic super-agent network and demo scenarios.

---

## 12. Deployment Notes

The live demo is deployed on Vercel:

```text
https://sali-project-1.vercel.app/
```

Recommended environment variables:

```text
DATABASE_URL="file:./db/custom.db"
OPENAI_API_KEY="server-side-only-key"
NEXT_PUBLIC_APP_NAME="SALI"
NEXT_PUBLIC_DEMO_MODE="true"
```

Important notes:

- `OPENAI_API_KEY` must stay server-side only.
- SQLite on Vercel is suitable for a hackathon demo, but may reset because serverless filesystem persistence is limited.
- For production, replace SQLite with a persistent database such as Postgres.
- The prototype must remain synthetic-data-only unless proper provider authorization, compliance, monitoring, and security review are completed.

---

## 13. Recommended Judge Demo Script

Use this flow during the live presentation:

```text
1. Open SALI live demo.
2. Show Command Center and explain the super-agent problem.
3. Open Unified Liquidity.
4. Show shared cash and provider balances separately.
5. Open Scenario B / liquidity pressure view.
6. Explain shortage forecast and unusual transaction evidence.
7. Open an alert detail or coordination case.
8. Show reason, evidence, confidence, uncertainty, owner, next step, and status.
9. Demonstrate claim / acknowledge / note / escalate / resolve workflow.
10. Show Risk Review for evidence-led review.
11. Show Audit Trail to prove traceability.
12. Show Metrics & Validation for measured evidence.
13. Mention Scenario C safe fallback for missing/conflicting data.
14. End with safety boundaries and limitations.
```





## 14. Repository Structure

```text
src/app/                 Next.js app pages and API routes
src/app/api/             Dashboard, alerts, cases, simulation, metrics, AI routes
src/lib/                 Forecasting, anomaly detection, simulation, config, DB client
src/components/          UI components and dashboard sections
src/hooks/               Client hooks and interaction helpers
prisma/schema.prisma     Data model for synthetic providers, agents, transactions, alerts, cases
public/                  Static assets
mini-services/realtime/  Optional realtime service for non-Vercel environments
download/                Supporting README and deployment notes
```

---


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

## 🔬 Analytical Approach (deep dive)

SALI's analytics are intentionally **small, rule-based, and explainable** — every output is auditable by a human. There are no black-box ML models in the alert path. Four modules work together.

### A. Liquidity forecast — *"When will I run out?"*

**Module:** `src/lib/forecast.ts`
**Goal:** project when an outlet's shared cash or a provider-specific e-money balance will fall below the **20% shortage threshold**.

**Inputs per (agent, scope):**
- 60-minute history of balance snapshots (5-minute resolution)
- Current balance + capacity
- Feed confidence + staleness flag

**How it works (plain English):**
1. Read the snapshots for the last hour from Prisma.
2. Compute **burn rate** = `(first balance − last balance) / hours`. Positive = draining.
3. If draining, project the time when `balance = capacity × 0.20`.
4. **Dampen confidence** if the signal is weak:
   - Feed marked stale → cap at 0.45 (low)
   - < 3 snapshots → cap at 0.55 (medium)
5. Return: current, capacity, burn rate, **hours-to-shortage**, projected timestamp, confidence (0–1), series points for the chart.

**Output shape:**
```jsonc
{
  "scope": "rocket",
  "label": "Rocket e-Money",
  "current": 95000,
  "capacity": 200000,
  "burnRatePerHour": 38000,
  "hoursToShortage": 1.6,
  "projectedShortageAt": "2026-07-12T10:24:00Z",
  "confidence": 0.78,
  "confidenceLabel": "medium"
}
```

**Why it matters:** providers are forecast **independently** — the aggregate KPI can be green while one provider is about to run dry (Scenario A). The forecast surfaces hidden per-provider pressure without ever merging provider boundaries.

---

### B. Anomaly detectors — *"Is anything unusual?"*

**Module:** `src/lib/anomaly.ts`
**Goal:** flag unusual activity with **evidence, uncertainty, and a safe next step** — never with a fraud declaration.

All three detectors return the same `DetectedAnomaly` shape:
```ts
{
  agentId, providerId, category, severity,
  title, message,
  evidence: { summary, facts, sampleTx, possibleNormalReasons, uncertainty, safeNextStep, falsePositiveNote },
  sampleTxIds, confidence, confidenceLabel
}
```

#### Detector 1 — Repeated near-identical amounts (`detectRepeatedAmounts`)
- **Window:** last 45 minutes
- **Rule:** bucket transactions by `round(amount / 100) × 100`; flag any bucket with **≥ 5 occurrences**
- **Severity:** `high` if ≤ 2 distinct customers; otherwise `warning`
- **Confidence formula:** `min(0.78, 0.45 + count·0.05 + (≤3 customers ? 0.12 : 0))`
- **False-positive guard:** rounded-to-100 bucketing absorbs small variation; capped at 0.78 so even on salary day it's never "high"
- **Always documents possible normal reasons:** Eid/salary disbursement, merchant batch settlement, single-employer payday

#### Detector 2 — Velocity spike (`detectVelocitySpike`)
- **Window:** last 30 min vs previous 30 min
- **Rule:** require ≥ 10 recent txns **and** recent/previous **ratio ≥ 3.0×**
- **Confidence:** `min(0.72, 0.40 + ratio·0.06)`
- **Always documents possible normal reasons:** payday spike, ATM outage nearby, market closing rush
- **Critical:** velocity alone is *never* treated as suspicious — the framework pairs it with amount pattern + context

#### Detector 3 — Data-quality conflict (`detectDataConflict`)
- **Rule:** flag **only** when (a) feed marked stale **and** latency > 60s, **or** (b) last sync > 4 minutes old
- **Confidence:** `max(0.30, 0.85 − latencyMs/200000)` — explicitly *reduces* confidence so AI refuses to recommend action
- **Purpose:** this is the safe-fallback trigger for Scenario C — better to dampen than to mislead

#### Scanner loop (`runAnomalyScan`)
- Iterates all 6 agents × 3 providers = **18 (agent, provider) pairs**
- Runs all 3 detectors in `Promise.all` per pair (parallel)
- Applies a **15-minute suppression window**: skip if a same-`(agent, provider, category)` alert was *resolved by a human* in the last 15 min
- Returns the list of new findings to persist

---

### C. Suppression window — *"Don't nag humans"*

**Module:** `src/lib/anomaly.ts` → `isSuppressed()`
**Why:** repeated patterns on salary/Eid days cause false-positive spam after the first resolution.

**Rule:** if a case with `(agentId, providerId, category)` was set to `status = "resolved"` in the last **15 minutes**, the same pattern is **not** re-fired. Forces a human re-trigger or escalation to surface it again.

---

### D. Live tick — *"The data should move"*

**Module:** `src/lib/simulate.ts` → `simulationTick()`
**Trigger:** Socket.io mini-service runs this every **~9 seconds**
**Concurrent anomaly re-scan:** every **~35 seconds**

**Per tick (per agent):**
- 0–3 fresh transactions (random provider, random amount, 95% success)
- Updates `agentProviderBalance.balance` (cash-in/out + cash increment/decrement)
- Appends a new snapshot row for both cash and the affected provider
- 18% chance to toggle a provider feed between fresh and stale (different latency + confidence)

**Result:** the dashboard reflects a **drifting, live network** without manual intervention. Burn rates, shortage ETAs, and detector outputs all update as new transactions arrive.

---

### Design principles behind every module

| Principle | How it shows up in the code |
|-----------|------------------------------|
| **Explainable** | Every detector returns `facts[]`, `sampleTx[]`, `possibleNormalReasons`, `uncertainty`, `safeNextStep`, and `falsePositiveNote`. |
| **Conservative** | Confidence is **capped**, never exceeds 0.85 for data-quality issues, and never exceeds 0.78 for repeated-amount patterns. |
| **Human-in-the-loop** | Detectors only **create alerts**. Routing, ack, escalation, and resolution are all human-driven role-gated actions that write audit rows. |
| **Provider-boundary preserving** | Forecasts and detectors run **per (agent, provider)**. Provider e-money balances are never merged, summed, or compared in a way that crosses logical boundaries. |
| **Bilingual & accessible** | Every alert has both `message` (English) and `messageBn` (Bengali) fields. AI explanations follow the same pattern. |
| **Safe fallback** | Stale feed → recommendation paused. Missing data → "advice: do not act on a single provider figure." |

---

### Where to see each piece in the UI

| Module | UI view |
|--------|---------|
| Forecast ETA + chart | **Unified Liquidity** |
| Anomaly evidence + AI advisory | **Anomaly Review** |
| Suppression + audit | **Coordination** + **Audit Trail** |
| Live tick broadcasting | **Command Center** (auto-refreshes) |
| Measured analytics + load test | **Metrics & Validation** |

---

### How to extend with a new detector

1. Add a new async function in `src/lib/anomaly.ts` returning `DetectedAnomaly | null`:
   ```ts
   export async function detectOffHoursActivity(agentId, providerId) { ... }
   ```
2. Add it to the `Promise.all` block in `runAnomalyScan()`.
3. Add the matching `isSuppressed(...)` check to honour the 15-minute window.
4. No UI changes needed — the anomaly card already renders from evidence.

---

## 🎬 Demo Scenarios (one-paragraph each)

- **Scenario A — Hidden Provider Shortage.** The aggregate KPI shows green across the network. But if you drill into one outlet, Rocket's e-money is projected to cross the 20% threshold in 38 minutes. The detector flags this and routes it to the outlet owner. *Watch the Confidence column in the Unified Liquidity view — it should turn amber for Rocket only.*

- **Scenario B — Liquidity + Unusual Activity.** Two things at once: (1) cash is draining at 2× normal rate, and (2) 14 transactions of exactly 4,999 BDT from 4 customers in 20 minutes. The detector tags both. The evidence card shows the 14 sample rows, the fact list, and a "possible normal reasons" note (salary day, vendor payouts). *No "fraud" label — only "unusual."*

- **Scenario C — Data Inconsistency.** The bKash feed goes stale for 90 seconds. The detector still alerts, but the confidence badge drops from "high" to "low," and the AI advisory says: "Recommendation paused — waiting for fresh data." *This is the safe fallback in action.*

- **Scenario D — Coordinated Response.** An alert is created, acknowledged by a Field Officer, escalated to an Area Manager (severity = critical), then resolved with a closing note. The audit trail shows 4 events with actor, role, timestamp, and reason. *Open the Audit Trail view to see the full chain.*

---


## 15. Limitations and Future Work

### Current Prototype Limitations

- Uses synthetic data only.
- SQLite demo database is not intended for production persistence on Vercel.
- No production provider API integration.
- AI assistance is advisory only and depends on server-side API key availability.
- Forecasting is explainable and deterministic; it is not a production liquidity risk model.
- Anomaly detection is evidence-led and intentionally conservative.

### Future Improvements

- Persistent Postgres deployment.
- Stronger authentication and organization-level RBAC.
- Provider-approved API integration after compliance review.
- More robust historical forecasting models.
- Better false-positive benchmarking across holiday, salary-day, and local-event scenarios.
- More complete load testing and observability.

---

## 16. Final Safety Statement

SALI detects, explains, and coordinates — but it never accuses, transfers, blocks, freezes, or controls money.

It is a practical, measurable, and responsible hackathon prototype for safer multi-provider agent operations.

---

**Built for Codex Community Hackathon · bKash presents SUST CSE Carnival 2026**
