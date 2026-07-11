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

