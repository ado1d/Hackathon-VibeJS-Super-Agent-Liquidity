# SALI — Super Agent Liquidity & Risk Intelligence Platform

> **Codex Community Hackathon · bKash presents SUST CSE Carnival 2026**
>
> A decision-support platform for multi-provider mobile financial service "super agents" (bKash, Nagad, Rocket). Unifies liquidity visibility, surfaces unusual activity with explainable evidence, and routes alerts through a safe, traceable human coordination workflow.
>
> **All data is SYNTHETIC.** No real customer, agent, or account is referenced. The prototype never executes real financial transactions.

---

## Problem Solved

Super agents serve customers across 3 providers from **one shared cash drawer** but **3 separate e-money balances**. They can't easily answer: *"Will I have enough cash and provider balance to keep serving customers for the next few hours?"*

SALI solves this by:
1. **Unifying** the view of physical cash + per-provider e-money (never merged)
2. **Forecasting** shortages before they disrupt service
3. **Detecting** unusual activity with evidence + uncertainty (never declaring fraud)
4. **Routing** alerts to the right human owner with a traceable coordination trail

---

## Key Features

### 12 Interactive Views
| View | Purpose |
|------|---------|
| **Command Center** | Network-wide KPIs, provider pressure, live alert feed, agent network health |
| **Unified Liquidity** | Shared cash + 3 provider balances, 60-min forecast chart, shortage projections with confidence |
| **Transactions** | Raw transaction explorer with filtering, anomaly tags, volume-by-provider chart |
| **Anomaly Review** | Explainable detectors (repeated amounts, velocity, data conflict) with evidence + AI advisory |
| **Coordination** | Case board, ownership, escalation ladder, full audit trail, role-gated actions |
| **Network Hotspots** | SVG Dhaka agent map, area-wise pressure ranking, nearby-agent support discovery |
| **Relationship Graph** | Cross-provider customer network view (simulated IDs) |
| **What-If Simulator** | Model demand shocks (0.5×–5×) and project liquidity impact |
| **AI Assistant** | Natural-language Q&A with conversation context + voice I/O |
| **Audit Trail** | Global traceable event timeline |
| **Metrics & Validation** | Architecture diagram, measured metrics, responsible-design note |
| **Simulation** | Trigger demo scenarios A/B/C/D, manual tick, anomaly scan |

### 6 Global Features
- **Guided Tour** — 6-step walkthrough with auto-advance demo mode
- **Command Palette** (⌘K) — fuzzy search + keyboard navigation
- **Conversational AI** — follow-up questions with history context
- **Voice I/O** — TTS output (hear answers) + ASR input (speak questions)
- **Demo Mode** — auto-advancing tour for hands-free presentations
- **Keyboard Shortcuts** — vim-style `g+letter` view switching, `A/E/R` coordination actions

### 4 Demo Scenarios (injected on seed)
- **A — Hidden Provider Shortage**: Aggregate looks healthy, but one provider's e-money is about to run out
- **B — Liquidity + Unusual Activity**: Cash draining fast + repeated near-identical amounts from a small customer group
- **C — Data Inconsistency**: Provider feed delayed/conflicting → confidence reduced, no confident recommendation
- **D — Coordinated Response**: Alert routed, acknowledged, escalated, resolved with full audit trail

---

## Tech Stack

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

## Architecture

```
Users & Roles (Agent / Field Ops / Area Mgr / Risk / Management)
    ↓ role-gated actions
Frontend — Next.js 16 (single route, 12 views)
    ↓ REST API
Backend — Next.js API Routes
  • Liquidity Forecast (burn-rate → ETA)
  • Anomaly Detectors (repeated·velocity·data)
  • Case Workflow (route·ack·escalate·resolve)
  • AI Explain (Bengali + English, safe fallback)
  • AI Assistant (conversational, live context)
  • TTS (voice output)
    ↓ reads / writes (synthetic)
Data & Realtime
  • Prisma + SQLite
  • Socket.io (:3001) — auto-tick every 9s, auto-scan every 35s
  • 3 Providers (logical) — bKash · Nagad · Rocket (separate boundaries)
```

---

## User Roles & Access Control

| Role | Views | Can Acknowledge | Can Escalate | Can Resolve |
|------|-------|:---:|:---:|:---:|
| Super Agent | 6 | ✓ | ✓ | ✓ |
| Field Officer | 8 | ✓ | ✓ | ✓ |
| Area Manager | 11 (all) | ✓ | ✓ | ✓ |
| Risk Analyst | 8 | ✓ | ✓ | ✗ |
| Management | 5 | ✗ | ✗ | ✗ |

---

## Responsible Design

- ✅ Careful language ("unusual" / "requires review" — never "fraud")
- ✅ Human review required before any action
- ✅ No automatic blocking, freezing, accusing, or fund movement
- ✅ Provider boundaries preserved (no cross-provider conversion)
- ✅ Synthetic data only (no real identities, credentials, PINs, OTPs)
- ✅ False-positive awareness documented per detector
- ✅ Low-confidence fallback when data is stale/conflicting

---

## Setup & Run

```bash
# Install dependencies
bun install

# Push database schema
bun run db:push

# Start the dev server (port 3000)
bun run dev

# Start the realtime service (port 3001)
cd mini-services/realtime && bun install && bun run dev
```

The app runs via the gateway on **port 81** → Next.js (:3000) + realtime (:3001).

---

## Measured Metrics

| Category | Metric | Value |
|----------|--------|-------|
| Analytics | Shortage lead-time | ~1.5h avg |
| Analytics | Anomaly recall | 4/4 (100%) |
| Analytics | Explanation coverage | 100% |
| Performance | p50 query latency | ~9ms |
| Reliability | Feed health | ~94% |
| Reliability | Case traceability | 100% |

---

## Hackathon Deliverables Checklist

- ✅ Working prototype (live multi-provider flow + alert coordination)
- ✅ Source repository (README, setup, sample data)
- ✅ Architecture diagram (in Metrics view)
- ✅ Data & simulation note (in Metrics view)
- ✅ Validation evidence (≥3 metrics in Metrics view)
- ✅ Responsible-design note (in Metrics view)
- ✅ Alert case study export (Markdown, from Coordination view)
- ✅ At least 2 provider contexts (bKash, Nagad, Rocket)
- ✅ Shared cash + provider-specific balances
- ✅ Forward-looking liquidity insight
- ✅ Anomaly category with evidence
- ✅ Human-review & careful risk language
- ✅ Alert routing, ownership, acknowledgement, escalation, resolution
- ✅ Failure/uncertainty/false-positive considerations
- ✅ Safety, privacy, boundaries, limitations stated

---

*Built for the Codex Community Hackathon · bKash presents SUST CSE Carnival 2026*
