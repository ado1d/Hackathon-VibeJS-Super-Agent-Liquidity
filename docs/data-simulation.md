# Synthetic Data and Scenario Design

All identities, locations, providers, balances, and transactions are invented. Scenario time is anchored at `2026-07-11T10:30:00+06:00`; seed values and external event IDs are stable.

## Balance mechanics

| Successful transaction | Physical cash | Provider e-money |
| --- | ---: | ---: |
| Customer cash-in | `+amount` | `-amount` |
| Customer cash-out | `-amount` | `+amount` |
| Failed | no movement | no movement |

Scenario loading holds a PostgreSQL advisory lock, clears only current operational rows, creates a labeled run, derives balances from the ledger, sets feed quality, and calculates forecasts and alerts. Historical run metadata and security audit logs remain available. Invalid external event IDs are constrained as unique and API payloads are validated before persistence.

## Expected behavior

- **Baseline:** balanced demand with no designed shortage.
- **A:** Provider A e-money reaches its buffer while Provider B and total value remain healthy.
- **B:** cash-out demand pressures shared cash and repeated near-identical transactions require review.
- **C:** a missing feed and a ledger/balance conflict suppress precise forecasting.
- **D:** a high-priority operations alert is ready for claim, acknowledgement, note, escalation, and closure.

