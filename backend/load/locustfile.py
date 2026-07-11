"""Repeatable dashboard/alert load profile and p95 artifact exporter."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from locust import HttpUser, between, events, task


class DashboardUser(HttpUser):
    wait_time = between(0.2, 1.0)

    def on_start(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login",
            json={"username": "operations", "password": "demo-pass"},
            name="POST /auth/login",
        )
        response.raise_for_status()
        self.client.headers.update(
            {"Authorization": f"Bearer {response.json()['access_token']}"}
        )

    @task(3)
    def dashboard(self) -> None:
        response = self.client.get("/api/v1/agents?page_size=50", name="GET /agents")
        if response.ok and response.json().get("items"):
            agent_id = response.json()["items"][0]["id"]
            self.client.get(
                f"/api/v1/agents/{agent_id}/overview", name="GET /agents/:id/overview"
            )

    @task(2)
    def alert_queue(self) -> None:
        response = self.client.get("/api/v1/alerts?page_size=50", name="GET /alerts")
        if response.ok and response.json().get("items"):
            alert_id = response.json()["items"][0]["id"]
            self.client.get(f"/api/v1/alerts/{alert_id}", name="GET /alerts/:id")


@events.quitting.add_listener
def export_latency(environment, **_kwargs) -> None:
    total = environment.stats.total
    output = Path(os.getenv("VALIDATION_DATA_DIR", "../data/validation"))
    output.mkdir(parents=True, exist_ok=True)
    payload = {
        "api_p95_ms": total.get_response_time_percentile(0.95),
        "request_count": total.num_requests,
        "failure_count": total.num_failures,
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": 60,
        "rate_limit_enabled": False,
    }
    (output / "latency.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
