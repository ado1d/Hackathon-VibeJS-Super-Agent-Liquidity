# PRD Compliance Matrix

| Requirement area | Implementation evidence | Automated evidence | Demo evidence |
| --- | --- | --- | --- |
| Separate provider e-money and shared cash | Models, agent overview/list APIs, separate dashboard cards | Scenario and API smoke tests | Scenarios A/B |
| Forecast and confidence fallback | Liquidity/confidence services; original scenario opening retained | Hypothesis invariants, Scenario C contract | Scenarios A/C |
| Explainable anomaly rules | Six rules plus secondary Isolation Forest | Rule tests and exact A–D anomaly sets | Scenarios B/C |
| Ledger/balance conflict | Reconciliation against immutable opening balance | Scenario C exact contract | Scenario C |
| Immutable ingestion | Quarantine-first batch import; append-only snapshots | Immutable-history test and API smoke | Admin import |
| Authentication and RBAC | Fixed-role JWT, database role lookup, scoped dependencies, no role-switch endpoint | Permission tests and API smoke | Sign out/sign in by role |
| Rate limiting | SlowAPI IP/subject limits; health exclusions | ASGI smoke checks standard 429 | Repeated login test |
| Alert workflow and audit | Exact state machine, atomic/idempotent claim, event and audit logs | Transition, claim, and smoke tests | Scenario D |
| Management privacy | Aggregate-only summary and severity treemap | Permission tests | Management landing |
| AI human-review boundary | Structured allow-list, `store=false`, denylist, fallback, cache | 50 unsafe cases plus safe-language cases | Optional AI segment |
| Offline demo | AI disabled by default; nearby list without map tiles | Frontend build and backend smoke | Full A–D walkthrough |
| Validation metrics | Exact anomaly-set metrics and measured/null p95 artifact | Metric definition test | Management evidence |
| Deployment | PostgreSQL, backend, unprivileged edge, migrations, health checks | Compose CI job | Demo VM checklist |

Q&A and AI note handover are intentionally not claimed as complete. They remain gated future work under [AI integration](ai-integration.md).
