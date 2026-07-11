# Limitations

- Forecast accuracy is demonstrated only on labeled synthetic scenarios and does not generalize to live provider demand.
- Scenario recomputation is synchronous and designed for a small hackathon dataset, not streaming scale.
- Isolation Forest is trained on the active synthetic sample and is only a secondary indication.
- Runtime Isolation Forest toggling is intentionally non-persistent; deployment environment configuration is authoritative.
- The demo VM configuration is not a regulated production baseline and excludes mandatory offsite backup, SIEM, HA, disaster recovery, and provider integration.
- API p95 must be populated by CI/load-test output; the application does not invent a latency value.

