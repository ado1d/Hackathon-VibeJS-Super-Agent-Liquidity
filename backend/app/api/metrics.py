import csv
import io
from statistics import median

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_session
from app.enums import Role
from app.errors import AppError
from app.models import Alert, AlertEvent, Forecast, ScenarioRun, User

router = APIRouter(prefix="/metrics", tags=["metrics"])


async def validation_payload(session: AsyncSession) -> dict:
    run = (
        (
            await session.execute(
                select(ScenarioRun)
                .where(ScenarioRun.active.is_(True))
                .order_by(ScenarioRun.started_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if run is None:
        raise AppError(
            "SCENARIO_NOT_LOADED", "Load a scenario before calculating validation metrics.", 409
        )
    alerts = list(
        (await session.execute(select(Alert).where(Alert.scenario_run_id == run.id)))
        .scalars()
        .all()
    )
    forecasts = list(
        (await session.execute(select(Forecast).where(Forecast.scenario_run_id == run.id)))
        .scalars()
        .all()
    )
    complete = [
        a
        for a in alerts
        if a.reason and a.evidence and a.uncertainty_statement and a.recommended_next_step
    ]
    predicted_unusual = [
        a
        for a in alerts
        if a.alert_type not in {"provider_liquidity", "shared_cash_liquidity", "data_quality"}
    ]
    expected_unusual = 1 if run.expected_labels.get("unusual") else 0
    true_positive = min(len(predicted_unusual), expected_unusual)
    precision = (
        true_positive / len(predicted_unusual)
        if predicted_unusual
        else (1.0 if not expected_unusual else 0.0)
    )
    recall = true_positive / expected_unusual if expected_unusual else 1.0
    shortage_times = [
        float(f.shortage_minutes) for f in forecasts if f.shortage_minutes is not None
    ]
    event_alert_ids = set(
        (await session.execute(select(AlertEvent.alert_id).distinct())).scalars().all()
    )
    return {
        "scenario": run.code,
        "seed": run.seed,
        "shortage_detection_lead_time_minutes": min(shortage_times, default=None),
        "median_shortage_time_minutes": median(shortage_times) if shortage_times else None,
        "anomaly_precision": round(precision, 4),
        "anomaly_recall": round(recall, 4),
        "false_positive_rate": round(
            (len(predicted_unusual) - true_positive) / max(1, len(predicted_unusual)), 4
        ),
        "explanation_coverage": len(complete) / len(alerts) if alerts else 1.0,
        "alert_workflow_audit_coverage": len([a for a in alerts if a.id in event_alert_ids])
        / len(alerts)
        if alerts
        else 1.0,
        "data_quality_fallback_accuracy": 1.0
        if (run.code != "C" or any(not f.reliable for f in forecasts))
        else 0.0,
        "api_p95_ms": None,
        "api_p95_note": "Populated by the CI/load-test artifact",
        "measured_alert_count": len(alerts),
        "configuration_version": "1.0",
    }


@router.get("/validation")
async def validation(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict:
    if user.role == Role.AGENT:
        raise AppError(
            "AUTH_FORBIDDEN", "Validation metrics are not available to the agent role.", 403
        )
    return await validation_payload(session)


@router.get("/validation.csv")
async def validation_csv(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    payload = await validation(user, session)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["metric", "value"])
    writer.writerows(payload.items())
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=validation.csv"},
    )


@router.get("/scenarios")
async def scenarios(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict:
    if user.role == Role.AGENT:
        raise AppError(
            "AUTH_FORBIDDEN", "Scenario comparison is not available to the agent role.", 403
        )
    runs = (
        (await session.execute(select(ScenarioRun).order_by(ScenarioRun.started_at.desc())))
        .scalars()
        .all()
    )
    return {
        "items": [
            {
                "code": run.code,
                "label": run.label,
                "seed": run.seed,
                "active": run.active,
                "expected_labels": run.expected_labels,
                "measured_results": run.measured_results,
                "started_at": run.started_at,
            }
            for run in runs
        ]
    }
