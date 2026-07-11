import math
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_session
from app.enums import Role
from app.errors import AppError
from app.models import (
    Agent,
    AgentProviderBalance,
    Alert,
    CashSnapshot,
    Forecast,
    Provider,
    ScenarioRun,
    Transaction,
    User,
)
from app.schemas import ForecastSimulationRequest
from app.services.liquidity import RateInput, forecast_liquidity, forecast_shared_cash

router = APIRouter(prefix="/agents", tags=["agents"])


async def scoped_agent(
    session: AsyncSession, agent_id: uuid.UUID, user: User, allow_management: bool = False
) -> Agent:
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise AppError("AGENT_NOT_FOUND", "Agent was not found.", 404)
    allowed = (
        user.role == Role.ADMIN
        or (user.role == Role.AGENT and agent.user_id == user.id)
        or (user.role == Role.OPERATIONS and agent.assigned_operations_user_id == user.id)
        or user.role == Role.RISK
        or (allow_management and user.role == Role.MANAGEMENT)
    )
    if not allowed:
        raise AppError("AUTH_FORBIDDEN", "This agent is outside your assigned scope.", 403)
    return agent


async def active_run(session: AsyncSession) -> ScenarioRun:
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
        raise AppError("SCENARIO_NOT_LOADED", "Load a demo scenario first.", 409)
    return run


@router.get("")
async def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    area: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    freshness_status: str | None = None,
    sort: str = "code",
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if user.role == Role.AGENT:
        scope = Agent.user_id == user.id
    elif user.role == Role.OPERATIONS:
        scope = Agent.assigned_operations_user_id == user.id
    else:
        scope = Agent.active.is_(True)
    query = select(Agent).where(scope)
    if area:
        query = query.where(Agent.area == area)
    if severity or status:
        alert_filter = select(Alert.agent_id)
        if severity:
            alert_filter = alert_filter.where(Alert.severity == severity)
        if status:
            alert_filter = alert_filter.where(Alert.status == status)
        query = query.where(Agent.id.in_(alert_filter))
    if freshness_status:
        feed_filter = select(AgentProviderBalance.agent_id).where(
            AgentProviderBalance.freshness_status == freshness_status
        )
        query = query.where(Agent.id.in_(feed_filter))
    order = Agent.name if sort == "name" else Agent.area if sort == "area" else Agent.code
    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    agents = (
        (
            await session.execute(
                query.order_by(order).offset((page - 1) * page_size).limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    run = (
        (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True))))
        .scalars()
        .first()
    )
    items = []
    for agent in agents:
        forecasts = (
            []
            if run is None
            else list(
                (
                    await session.execute(
                        select(Forecast).where(
                            Forecast.agent_id == agent.id, Forecast.scenario_run_id == run.id
                        )
                    )
                )
                .scalars()
                .all()
            )
        )
        alerts = (
            0
            if run is None
            else (
                await session.execute(
                    select(func.count(Alert.id)).where(
                        Alert.agent_id == agent.id,
                        Alert.scenario_run_id == run.id,
                        Alert.status != "resolved",
                    )
                )
            ).scalar_one()
        )
        items.append(
            {
                "id": agent.id,
                "code": agent.code,
                "name": agent.name,
                "area": agent.area,
                "nearest_shortage_minutes": min(
                    (
                        float(f.shortage_minutes)
                        for f in forecasts
                        if f.shortage_minutes is not None
                    ),
                    default=None,
                ),
                "health": min((f.severity.value for f in forecasts), default="healthy"),
                "alert_count": alerts,
            }
        )
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/{agent_id}")
async def get_agent(
    agent_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    agent = await scoped_agent(session, agent_id, user, allow_management=True)
    return {
        "id": agent.id,
        "code": agent.code,
        "name": agent.name,
        "area": agent.area,
        "latitude": agent.latitude,
        "longitude": agent.longitude,
    }


@router.get("/{agent_id}/overview", response_model=None)
async def overview(
    agent_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    agent = await scoped_agent(session, agent_id, user)
    run = await active_run(session)
    balances = (
        await session.execute(
            select(AgentProviderBalance, Provider)
            .join(Provider, Provider.id == AgentProviderBalance.provider_id)
            .where(
                AgentProviderBalance.agent_id == agent.id,
                AgentProviderBalance.scenario_run_id == run.id,
            )
            .order_by(Provider.code)
        )
    ).all()
    cash = (
        (
            await session.execute(
                select(CashSnapshot)
                .where(CashSnapshot.agent_id == agent.id, CashSnapshot.scenario_run_id == run.id)
                .order_by(CashSnapshot.source_timestamp.desc())
            )
        )
        .scalars()
        .first()
    )
    forecasts = (
        (
            await session.execute(
                select(Forecast).where(
                    Forecast.agent_id == agent.id, Forecast.scenario_run_id == run.id
                )
            )
        )
        .scalars()
        .all()
    )
    alerts = (
        (
            await session.execute(
                select(Alert)
                .where(Alert.agent_id == agent.id, Alert.scenario_run_id == run.id)
                .order_by(Alert.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "agent": {"id": agent.id, "code": agent.code, "name": agent.name, "area": agent.area},
        "active_scenario": {"code": run.code, "label": run.label},
        "shared_cash": None
        if cash is None
        else {
            "balance": cash.balance,
            "quality_status": cash.quality_status,
            "source_timestamp": cash.source_timestamp,
        },
        "providers": [
            {
                "id": provider.id,
                "code": provider.code,
                "name": provider.display_name,
                "color": provider.color,
                "balance": balance.balance,
                "freshness_status": balance.freshness_status,
                "quality_status": balance.quality_status,
                "source_timestamp": balance.source_timestamp,
                "quality_details": balance.quality_details,
            }
            for balance, provider in balances
        ],
        "forecasts": forecasts,
        "alerts": alerts,
        "data_quality_warning": any(
            balance.quality_status.value != "fresh" for balance, _ in balances
        ),
    }


@router.get("/{agent_id}/transactions", response_model=None)
async def transactions(
    agent_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    provider_id: uuid.UUID | None = None,
    status: str | None = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await scoped_agent(session, agent_id, user)
    run = await active_run(session)
    query = select(Transaction).where(
        Transaction.agent_id == agent_id, Transaction.scenario_run_id == run.id
    )
    if provider_id:
        query = query.where(Transaction.provider_id == provider_id)
    if status:
        query = query.where(Transaction.status == status)
    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    items = (
        (
            await session.execute(
                query.order_by(Transaction.occurred_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.post("/{agent_id}/forecast-simulation")
async def simulate(
    agent_id: uuid.UUID,
    payload: ForecastSimulationRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await scoped_agent(session, agent_id, user)
    run = await active_run(session)
    forecasts = (
        (
            await session.execute(
                select(Forecast).where(
                    Forecast.agent_id == agent_id, Forecast.scenario_run_id == run.id
                )
            )
        )
        .scalars()
        .all()
    )
    results = []
    for item in forecasts:
        rate = RateInput(
            Decimal(str(item.contributing_factors.get("cash_in_rate", 0))) * 60,
            Decimal(str(item.contributing_factors.get("cash_out_rate", 0))) * 60,
            60,
        )
        fn = forecast_shared_cash if item.resource_type == "shared_cash" else forecast_liquidity
        result = fn(
            item.current_balance,
            item.minimum_buffer,
            rate,
            demand_multiplier=Decimal(str(payload.demand_multiplier)),
            reliable=item.reliable,
        )
        results.append(
            {
                "resource_type": item.resource_type,
                "provider_id": item.provider_id,
                "shortage_minutes": result.shortage_minutes,
                "severity": result.severity,
                "reliable": result.reliable,
            }
        )
    return {
        "demand_multiplier": payload.demand_multiplier,
        "persisted": False,
        "forecasts": results,
    }


@router.get("/{agent_id}/nearby")
async def nearby(
    agent_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    origin = await scoped_agent(session, agent_id, user)
    agents = (
        (await session.execute(select(Agent).where(Agent.id != origin.id, Agent.active.is_(True))))
        .scalars()
        .all()
    )

    def distance(item: Agent) -> float:
        lat1, lon1, lat2, lon2 = map(
            math.radians,
            [
                float(origin.latitude),
                float(origin.longitude),
                float(item.latitude),
                float(item.longitude),
            ],
        )
        a = (
            math.sin((lat2 - lat1) / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
        )
        return 6371 * 2 * math.asin(math.sqrt(a))

    ordered = sorted(((item, distance(item)) for item in agents), key=lambda pair: pair[1])[:3]
    return {
        "agents": [
            {
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "area": item.area,
                "distance_km": round(km, 2),
            }
            for item, km in ordered
        ],
        "notice": "Discovery only. Contact operations for approved support; no transfer is initiated.",
    }


@router.get("/{agent_id}/relationships")
async def relationships(
    agent_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await scoped_agent(session, agent_id, user)
    run = await active_run(session)
    rows = (
        await session.execute(
            select(
                Transaction.synthetic_customer_id,
                Transaction.provider_id,
                func.count(Transaction.id),
                func.sum(Transaction.amount),
            )
            .where(Transaction.agent_id == agent_id, Transaction.scenario_run_id == run.id)
            .group_by(Transaction.synthetic_customer_id, Transaction.provider_id)
        )
    ).all()
    return {
        "nodes": [{"id": str(agent_id), "type": "agent"}]
        + [
            {"id": customer, "type": "synthetic_identifier"}
            for customer in sorted({r[0] for r in rows})
        ],
        "edges": [
            {
                "source": str(agent_id),
                "target": customer,
                "provider_id": provider,
                "count": count,
                "total_bdt": total,
            }
            for customer, provider, count, total in rows
        ],
        "synthetic_only": True,
    }
