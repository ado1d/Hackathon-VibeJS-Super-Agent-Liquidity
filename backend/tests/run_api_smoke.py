"""End-to-end ASGI smoke for auth, scope, dashboard, and case workflow."""

import asyncio

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.main import app
from app.services.scenarios import load_scenario


async def main() -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        await load_scenario(session, "D")

    async def session_override():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login", json={"username": "operations", "password": "demo-pass"}
        )
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        agents = await client.get("/api/v1/agents", headers=headers)
        assert agents.status_code == 200 and agents.json()["items"]
        agent_id = agents.json()["items"][0]["id"]
        overview = await client.get(f"/api/v1/agents/{agent_id}/overview", headers=headers)
        assert overview.status_code == 200 and len(overview.json()["providers"]) == 2
        queue = await client.get("/api/v1/alerts", headers=headers)
        assert queue.status_code == 200 and queue.json()["items"]
        alert_id = queue.json()["items"][0]["id"]
        assert (
            await client.post(f"/api/v1/alerts/{alert_id}/claim", headers=headers)
        ).status_code == 200
        assert (
            await client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=headers)
        ).status_code == 200
        assert (
            await client.post(
                f"/api/v1/alerts/{alert_id}/notes",
                headers=headers,
                json={"content": "Agent contacted using the approved support process."},
            )
        ).status_code == 200
        assert (
            await client.post(
                f"/api/v1/alerts/{alert_id}/escalate",
                headers=headers,
                json={"assigned_role": "risk", "note": "Review requested."},
            )
        ).status_code == 200
        switched = await client.post(
            "/api/v1/auth/switch-role", headers=headers, json={"role": "risk"}
        )
        risk_headers = {"Authorization": f"Bearer {switched.json()['access_token']}"}
        assert (
            await client.post(f"/api/v1/alerts/{alert_id}/in-progress", headers=risk_headers)
        ).status_code == 200
        resolved = await client.post(
            f"/api/v1/alerts/{alert_id}/resolve",
            headers=risk_headers,
            json={
                "resolution_code": "reviewed_no_further_action",
                "note": "Synthetic evidence reviewed; no further action.",
            },
        )
        assert resolved.status_code == 200, resolved.text
        detail = await client.get(f"/api/v1/alerts/{alert_id}", headers=risk_headers)
        assert detail.status_code == 200 and len(detail.json()["events"]) >= 6
        admin_login = await client.post(
            "/api/v1/auth/login", json={"username": "admin", "password": "demo-pass"}
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        imported = await client.post(
            "/api/v1/admin/transactions/import",
            headers=admin_headers,
            json=[
                {
                    "external_event_id": "API-SMOKE-1",
                    "agent_code": "AG-1001",
                    "provider_code": "PROVIDER_A",
                    "transaction_type": "cash_in",
                    "amount": "500.00",
                    "status": "success",
                    "synthetic_customer_id": "SYN-API-1",
                    "occurred_at": "2026-07-11T10:31:00+06:00",
                },
                {
                    "external_event_id": "API-SMOKE-BAD",
                    "agent_code": "AG-1001",
                    "provider_code": "PROVIDER_A",
                    "transaction_type": "cash_in",
                    "amount": "-1",
                    "status": "success",
                    "synthetic_customer_id": "SYN-API-2",
                    "occurred_at": "2026-07-11T10:31:00+06:00",
                },
            ],
        )
        assert imported.status_code == 200, imported.text
        assert imported.json() == {
            "accepted": 1,
            "quarantined": 1,
            "forecast_recalculation": "completed",
        }
    app.dependency_overrides.clear()
    await engine.dispose()
    print("api smoke: auth, RBAC, overview, workflow, quarantine, and recomputation passed")


if __name__ == "__main__":
    asyncio.run(main())
