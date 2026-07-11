# Responsible Design

This prototype supports operational decisions; it is not a wallet, payment switch, production fraud engine, or regulatory determination.

Mandatory safeguards:

- Synthetic identifiers only; no names, phone numbers, credentials, PINs, OTPs, or production API connections.
- Provider balances remain separate in storage, analytics, and presentation.
- Alerts say “unusual” and “requires review,” never “fraud confirmed.”
- Evidence, confidence deductions, uncertainty, and a safe next step appear together.
- Missing or conflicting data suppresses precise shortage times.
- No transfer, refill, block, freeze, or automatic provider-to-provider action exists.
- Backend RBAC and append-only workflow/audit writers protect coordination history.
- Nearby-agent discovery is informational and routes users through approved operations support.

## Optional AI boundary

- AI is disabled by default and is never required for liquidity, detection, case workflow, or the offline demo.
- Only allow-listed structured synthetic alert fields may leave the application; credentials, audit metadata, notes, and unrestricted records are excluded.
- Provider requests use `store=false`; structured output is validated and checked by a deterministic unsafe-language filter.
- AI text is advisory, visibly uncertain, and always requires an authorized human decision.
- Rejected output is neither persisted nor returned. Provider failures use a deterministic safe fallback.
- Free-form Q&A and AI note handover are deferred until live safety evaluation passes.

See [AI integration](ai-integration.md) for schemas, caching, cost accounting, and evaluation details.
