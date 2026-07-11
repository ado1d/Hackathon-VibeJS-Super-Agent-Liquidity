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

Imported records are validated and quarantined before balance calculation. Accepted batches append one provider snapshot per affected provider and one cash snapshot per affected agent; prior snapshots are never edited. Recalculation always reconciles the complete ledger against the original scenario opening balance.

## Exact anomaly metrics

Each scenario stores the exact expected anomaly-type set `E`. The detected anomaly-type set is `D`; liquidity and data-quality alerts are excluded from this comparison.

- Detection score: `|D ∩ E| / max(1, |D|)`.
- Detection coverage: `|D ∩ E| / max(1, |E|)`.
- Unexpected anomaly rate: `|D − E| / max(1, |D|)`.

The formulas apply literally to empty sets: an empty numerator produces `0`, including when both sets are empty. This avoids presenting “perfect” precision or coverage where no anomaly evidence exists.
