# Super Agent Liquidity & Risk Intelligence Platform

An explainable, synthetic-data decision-support prototype for agents who share physical cash while maintaining separate provider e-money balances. It does not move money, connect to production providers, or determine fraud.

## Quick start

1. Copy `.env.example` to `.env` and replace the database and JWT secrets.
2. Run `docker compose up -d --build`.
3. Open <http://localhost> and load a deterministic scenario from the Admin page.

Demo accounts use password `demo-pass` after seeding: `agent`, `operations`, `risk`, `management`, and `admin`.

## Developer setup

- `make dev` starts PostgreSQL, hot-reloading FastAPI, and Vite.
- `make test`, `make lint`, and `make e2e` run the verification suites.
- `make seed` restores baseline; `make demo` loads Scenario D.

All identities, providers, balances, locations, and transactions are synthetic. See `docs/demo-script.md` and `docs/responsible-design.md` before presenting.

