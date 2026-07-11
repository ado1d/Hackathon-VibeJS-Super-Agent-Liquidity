.PHONY: up dev down migrate seed reset demo test e2e lint metrics load-test

up:
	docker compose up -d --build

dev:
	docker compose -f compose.yaml -f compose.dev.yaml up --build postgres backend frontend-dev

down:
	docker compose down

migrate:
	docker compose run --rm backend alembic upgrade head

seed:
	docker compose run --rm backend python -m app.seed.cli load baseline

reset:
	docker compose run --rm backend python -m app.seed.cli reset

demo:
	docker compose run --rm backend python -m app.seed.cli load D

test:
	cd backend && python -m pytest
	cd frontend && npm test -- --run

load-test:
	docker compose -f compose.yaml -f compose.loadtest.yaml --profile loadtest up --build --abort-on-container-exit locust

e2e:
	cd frontend && npm run e2e

lint:
	cd backend && ruff check app tests && mypy app
	cd frontend && npm run lint && npm run typecheck

metrics:
	docker compose run --rm backend python -m app.seed.cli metrics
