"""Structured, synthetic-only OpenAI features with deterministic fallbacks."""

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    AIResponseCache,
    Agent,
    AgentProviderBalance,
    Alert,
    CashSnapshot,
    Forecast,
    Provider,
    ScenarioRun,
    User,
)
from app.schemas import AssistantMessage

PROMPT_VERSIONS = {
    "translate": "translate-v1",
    "summarize": "summary-v1",
    "recommendations": "recommendations-v1",
}


class TranslationResult(BaseModel):
    language: Literal["bn", "banglish"]
    summary: str
    reason: str
    uncertainty: str
    recommended_next_step: str
    human_review_required: bool = True


class SummaryResult(BaseModel):
    headline: str
    situation: str
    evidence_points: list[str] = Field(min_length=1, max_length=5)
    uncertainty: str
    recommended_next_step: str
    human_review_required: bool = True


class RecommendationResult(BaseModel):
    advisory_actions: list[str] = Field(min_length=1, max_length=5)
    prohibited_actions: list[str] = Field(min_length=1, max_length=5)
    uncertainty: str
    human_review_required: bool = True


ResultModel = TranslationResult | SummaryResult | RecommendationResult

_UNSAFE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bconfirmed fraud\b",
        r"\bis fraudulent\b",
        r"\bcommitted fraud\b",
        r"\bblock(?:ed|ing)? (?:the )?(?:account|customer|agent)\b",
        r"\bfreez(?:e|es|ing) (?:the )?(?:account|funds|balance)\b",
        r"\baccus(?:e|es|ed|ation|ing)\b",
        r"\bguilt(?:y)?\b",
        r"\bautomatically transfer\b",
        r"\bautomatic transfer\b",
        r"\bauto[- ]?transfer\b",
        r"\btransfer funds without (?:approval|review)\b",
    )
]

ASSISTANT_PROMPT_VERSION = "assistant-v1"
ASSISTANT_INSTRUCTIONS = (
    "You are SALI Assistant, an operations helper for a synthetic multi-provider "
    "mobile financial-service super-agent prototype in Bangladesh. Answer only from "
    "the supplied synthetic JSON context. Never declare fraud, guilt, illegality, "
    "or certainty about customer intent. Never recommend blocking, freezing, "
    "accusing, automatic transfers, provider-to-provider conversion, or any financial "
    "action without authorized human review. Use careful language such as unusual, "
    "requires review, needs context, and advisory. Keep answers to 3-6 concise "
    "sentences and mention uncertainty or human review when relevant."
)


def safety_violations(value: Any) -> list[str]:
    """Return matched unsafe-action categories without echoing generated text."""
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return [pattern.pattern for pattern in _UNSAFE_PATTERNS if pattern.search(text)]


def _json_safe(value: Any) -> Any:
    if hasattr(value, "value"):
        return value.value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def ai_is_enabled() -> bool:
    settings = get_settings()
    return bool(
        settings.ai_enabled
        and settings.openai_api_key
        and settings.openai_api_key.get_secret_value().strip()
    )


def structured_alert_context(alert: Alert) -> dict[str, Any]:
    """Allow-list the only synthetic alert fields sent to the provider."""
    return {
        "alert_type": alert.alert_type,
        "severity": alert.severity.value,
        "status": alert.status.value,
        "summary": alert.summary,
        "reason": alert.reason,
        "evidence": alert.evidence,
        "confidence": float(alert.confidence),
        "confidence_reasons": alert.confidence_reasons,
        "data_quality_status": alert.data_quality_status.value,
        "uncertainty": alert.uncertainty_statement,
        "recommended_next_step": alert.recommended_next_step,
    }


async def _assistant_context(session: AsyncSession, user: User) -> dict[str, Any]:
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
    agent_rows = list(
        (await session.execute(select(Agent).where(Agent.active.is_(True)))).scalars().all()
    )
    alerts = list(
        (
            await session.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(12)
            )
        )
        .scalars()
        .all()
    )
    forecasts = (
        []
        if run is None
        else list(
            (
                await session.execute(
                    select(Forecast).where(Forecast.scenario_run_id == run.id)
                )
            )
            .scalars()
            .all()
        )
    )
    providers = {
        item.id: item
        for item in (await session.execute(select(Provider))).scalars().all()
    }
    balances = (
        []
        if run is None
        else (
            await session.execute(
                select(AgentProviderBalance).where(
                    AgentProviderBalance.scenario_run_id == run.id
                )
            )
        )
        .scalars()
        .all()
    )
    cash = (
        []
        if run is None
        else (
            await session.execute(
                select(CashSnapshot).where(CashSnapshot.scenario_run_id == run.id)
            )
        )
        .scalars()
        .all()
    )

    latest_balances: dict[tuple[Any, Any], AgentProviderBalance] = {}
    for balance in balances:
        key = (balance.agent_id, balance.provider_id)
        current = latest_balances.get(key)
        if current is None or (
            balance.source_timestamp,
            balance.received_timestamp,
            balance.id,
        ) > (
            current.source_timestamp,
            current.received_timestamp,
            current.id,
        ):
            latest_balances[key] = balance
    latest_cash: dict[Any, CashSnapshot] = {}
    for snapshot in cash:
        current_cash = latest_cash.get(snapshot.agent_id)
        if current_cash is None or (
            snapshot.source_timestamp,
            snapshot.received_timestamp,
            snapshot.id,
        ) > (
            current_cash.source_timestamp,
            current_cash.received_timestamp,
            current_cash.id,
        ):
            latest_cash[snapshot.agent_id] = snapshot

    latest_provider_totals: dict[str, float] = {}
    latest_provider_stale: dict[str, int] = {}
    for balance in latest_balances.values():
        provider = providers.get(balance.provider_id)
        if provider is None:
            continue
        latest_provider_totals[provider.code] = latest_provider_totals.get(provider.code, 0) + float(
            balance.balance
        )
        if balance.quality_status.value != "fresh":
            latest_provider_stale[provider.code] = latest_provider_stale.get(provider.code, 0) + 1

    agent_pressure: list[dict[str, Any]] = []
    for agent in agent_rows:
        agent_forecasts = [item for item in forecasts if item.agent_id == agent.id]
        agent_alerts = [item for item in alerts if item.agent_id == agent.id]
        agent_cash = latest_cash.get(agent.id)
        agent_pressure.append(
            {
                "code": agent.code,
                "area": agent.area,
                "cash_balance": float(agent_cash.balance) if agent_cash else None,
                "nearest_shortage_minutes": min(
                    (
                        float(item.shortage_minutes)
                        for item in agent_forecasts
                        if item.shortage_minutes is not None
                    ),
                    default=None,
                ),
                "open_alerts": len(
                    [item for item in agent_alerts if item.status.value != "resolved"]
                ),
                "worst_severity": min(
                    (item.severity.value for item in agent_forecasts),
                    default="watch",
                ),
            }
        )

    return {
        "prototype": "SALI synthetic decision-support demo",
        "role": user.role.value,
        "scenario": None
        if run is None
        else {
            "code": run.code,
            "label": run.label,
            "seed": run.seed,
            "expected_labels": run.expected_labels,
        },
        "kpis": {
            "active_agents": len(agent_rows),
            "open_alerts": len([item for item in alerts if item.status.value != "resolved"]),
            "critical_or_high_alerts": len(
                [
                    item
                    for item in alerts
                    if item.status.value != "resolved"
                    and item.severity.value in {"critical", "high"}
                ]
            ),
            "total_shared_cash_bdt": round(
                sum(float(item.balance) for item in latest_cash.values()), 2
            ),
            "provider_totals_bdt": latest_provider_totals,
            "provider_data_quality_counts": latest_provider_stale,
        },
        "top_alerts": [
            {
                "type": item.alert_type,
                "severity": item.severity.value,
                "status": item.status.value,
                "summary": item.summary,
                "confidence": float(item.confidence),
                "uncertainty": item.uncertainty_statement,
            }
            for item in alerts[:6]
        ],
        "agent_pressure": sorted(
            agent_pressure,
            key=lambda item: (
                item["nearest_shortage_minutes"] is None,
                item["nearest_shortage_minutes"] or 999999,
                -item["open_alerts"],
            ),
        )[:8],
        "boundaries": [
            "Synthetic data only",
            "Provider balances are separate and not interchangeable",
            "Advisory support only; no automatic financial action",
            "Human review is required for consequential decisions",
        ],
    }


def _cache_key(feature: str, model: str, prompt_version: str, context: dict[str, Any]) -> str:
    canonical = json.dumps(
        {
            "feature": feature,
            "model": model,
            "prompt_version": prompt_version,
            "context": context,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _output_model(feature: str) -> type[BaseModel]:
    if feature == "translate":
        return TranslationResult
    if feature == "summarize":
        return SummaryResult
    return RecommendationResult


def _instructions(feature: str, language: str | None) -> str:
    shared = (
        "Use only the supplied synthetic alert JSON. Give advisory decision support, "
        "require human review, preserve uncertainty, and never declare fraud or instruct "
        "blocking, freezing, accusation, or an automatic financial transfer."
    )
    if feature == "translate":
        target = "Bengali script" if language == "bn" else "Banglish in Latin script"
        return f"{shared} Translate faithfully into {target}; do not add facts."
    if feature == "summarize":
        return f"{shared} Produce a concise operational handoff summary."
    return f"{shared} Suggest only reversible, approved operational review steps."


def _fallback(feature: str, context: dict[str, Any], language: str | None) -> ResultModel:
    if feature == "translate":
        if language == "bn":
            return TranslationResult(
                language="bn",
                summary="সতর্কতাটি মানব পর্যালোচনার জন্য তৈরি করা হয়েছে।",
                reason="কাঠামোবদ্ধ প্রমাণে একটি পর্যালোচনাযোগ্য পরিবর্তন দেখা গেছে।",
                uncertainty="তথ্য বা চাহিদা বদলালে ব্যাখ্যাটি বদলাতে পারে।",
                recommended_next_step="অনুমোদিত সহায়তার জন্য দায়িত্বপ্রাপ্ত কর্মকর্তার সাথে যাচাই করুন।",
            )
        return TranslationResult(
            language="banglish",
            summary="Alert-ti manob review-er jonno toiri kora hoyeche.",
            reason="Structured evidence-e review kora dorkar emon poriborton dekha geche.",
            uncertainty="Data ba demand bodle gele byakhya bodlate pare.",
            recommended_next_step="Approved support-er jonno dayitto-prapto officer-er sathe verify korun.",
        )
    if feature == "summarize":
        return SummaryResult(
            headline=str(context["summary"]),
            situation=str(context["reason"]),
            evidence_points=[
                f"Severity: {context['severity']}",
                f"Confidence: {context['confidence']:.0%}",
                f"Data quality: {context['data_quality_status']}",
            ],
            uncertainty=str(context["uncertainty"]),
            recommended_next_step=str(context["recommended_next_step"]),
        )
    return RecommendationResult(
        advisory_actions=[
            "Review the structured synthetic evidence with the assigned human owner.",
            "Verify feed freshness and approved operational support options.",
        ],
        prohibited_actions=[
            "Do not treat this signal as proof of wrongdoing.",
            "Do not initiate a financial action without authorized human review.",
        ],
        uncertainty=str(context["uncertainty"]),
    )


def _assistant_fallback(question: str, context: dict[str, Any]) -> str:
    q = question.lower()
    kpis = context["kpis"]
    top_alerts = context["top_alerts"]
    pressure = context["agent_pressure"]
    if any(term in q for term in ("shortage", "liquidity", "cash", "balance", "run out")):
        tight = [
            item
            for item in pressure
            if item["nearest_shortage_minutes"] is not None
            and item["nearest_shortage_minutes"] <= 180
        ]
        if tight:
            names = ", ".join(
                f"{item['code']} in {item['area']} ({round(item['nearest_shortage_minutes'])} min)"
                for item in tight[:3]
            )
            return (
                f"The most time-sensitive liquidity pressure is at {names}. "
                "Treat this as advisory: confirm feed freshness and demand context before arranging approved support. "
                "Provider balances remain separate and should not be treated as transferable. Synthetic data only."
            )
        return (
            "No agent in the current synthetic snapshot has a precise shortage inside the next three hours. "
            f"Shared cash totals about {kpis['total_shared_cash_bdt']:,.0f} BDT across the visible network. "
            "Continue monitoring because demand and data quality can change. Human review remains required."
        )
    if any(term in q for term in ("anomaly", "unusual", "alert", "review")):
        if top_alerts:
            lead = "; ".join(
                f"{item['severity']} {item['type']}: {item['summary']}" for item in top_alerts[:3]
            )
            return (
                f"There are {kpis['open_alerts']} open alerts, including {lead}. "
                "These are explainable review signals, not conclusions about wrongdoing. "
                "Use the evidence panel and audit workflow before any operational decision."
            )
        return (
            "There are no open alerts in the current synthetic snapshot. "
            "The prototype still keeps forecast, anomaly, and data-quality checks separate for review."
        )
    if any(term in q for term in ("scenario", "demo", "simulation")):
        scenario = context.get("scenario")
        if scenario:
            return (
                f"Scenario {scenario['code']} is active: {scenario['label']}. "
                "Use Simulation to reset or load A-D, then check Command Center, Liquidity, Anomaly Review, and Coordination. "
                "All records are deterministic synthetic data."
            )
        return "No scenario is active. Ask an admin to load a deterministic scenario before reviewing demo metrics."
    return (
        f"Network snapshot: {kpis['active_agents']} active agents, {kpis['open_alerts']} open alerts, "
        f"{kpis['critical_or_high_alerts']} critical/high alerts, and provider totals {kpis['provider_totals_bdt']}. "
        "This is synthetic advisory context only; human review is required before consequential action."
    )


async def run_assistant(
    session: AsyncSession,
    user: User,
    question: str,
    history: list[AssistantMessage],
) -> dict[str, Any]:
    settings = get_settings()
    context = await _assistant_context(session, user)
    fallback = _assistant_fallback(question, context)
    if not ai_is_enabled():
        return {
            "ok": True,
            "answer": fallback,
            "source": "deterministic_fallback",
            "model": None,
            "prompt_version": ASSISTANT_PROMPT_VERSION,
            "context": {
                "open_alerts": context["kpis"]["open_alerts"],
                "active_agents": context["kpis"]["active_agents"],
            },
        }

    try:
        from openai import AsyncOpenAI

        api_key = settings.openai_api_key
        if api_key is None:
            raise ValueError("The provider API key is not configured.")
        recent_history = [
            {"role": item.role, "content": item.content} for item in history[-6:]
        ]
        client = AsyncOpenAI(
            api_key=api_key.get_secret_value(),
            timeout=settings.ai_timeout_seconds,
            max_retries=0,
        )
        assistant_input: Any = [
            {
                "role": "user",
                "content": "Synthetic live context JSON:\n"
                + json.dumps(context, ensure_ascii=False, default=_json_safe),
            },
            *recent_history,
            {"role": "user", "content": question},
        ]
        response = await client.responses.create(
            model=settings.openai_model,
            instructions=ASSISTANT_INSTRUCTIONS,
            input=assistant_input,
            max_output_tokens=settings.ai_max_output_tokens,
            store=False,
        )
        answer = response.output_text.strip()
        if not answer or safety_violations(answer):
            raise ValueError("Assistant output did not pass deterministic safety checks.")
        return {
            "ok": True,
            "answer": answer,
            "source": "openai",
            "model": settings.openai_model,
            "prompt_version": ASSISTANT_PROMPT_VERSION,
            "context": {
                "open_alerts": context["kpis"]["open_alerts"],
                "active_agents": context["kpis"]["active_agents"],
            },
        }
    except Exception:
        return {
            "ok": True,
            "answer": fallback,
            "source": "deterministic_fallback",
            "model": settings.openai_model,
            "prompt_version": ASSISTANT_PROMPT_VERSION,
            "context": {
                "open_alerts": context["kpis"]["open_alerts"],
                "active_agents": context["kpis"]["active_agents"],
            },
        }


async def run_ai_feature(
    session: AsyncSession,
    alert: Alert,
    feature: Literal["translate", "summarize", "recommendations"],
    language: Literal["bn", "banglish"] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    context = structured_alert_context(alert)
    if language:
        context["target_language"] = language
    prompt_version = PROMPT_VERSIONS[feature]
    key = _cache_key(feature, settings.openai_model, prompt_version, context)
    now = datetime.now(timezone.utc)
    cached = (
        await session.execute(
            select(AIResponseCache).where(
                AIResponseCache.cache_key == key,
                AIResponseCache.expires_at > now,
                AIResponseCache.safety_status == "approved",
            )
        )
    ).scalar_one_or_none()
    if cached is not None:
        cached.hit_count += 1
        cached.last_accessed_at = now
        await session.commit()
        result = cached.response_payload
        return {
            "feature": feature,
            "source": "cache",
            "cached": True,
            "model": cached.model,
            "prompt_version": cached.prompt_version,
            "result": result,
            "uncertainty": result["uncertainty"],
        }

    fallback = _fallback(feature, context, language)
    try:
        # Keep the optional provider SDK out of the offline/core startup path.
        from openai import AsyncOpenAI

        api_key = settings.openai_api_key
        if api_key is None:
            raise ValueError("The provider API key is not configured.")
        client = AsyncOpenAI(
            api_key=api_key.get_secret_value(),
            timeout=settings.ai_timeout_seconds,
            max_retries=0,
        )
        response = await client.responses.parse(
            model=settings.openai_model,
            instructions=_instructions(feature, language),
            input=json.dumps(context, ensure_ascii=False, sort_keys=True, default=str),
            text_format=_output_model(feature),
            max_output_tokens=settings.ai_max_output_tokens,
            store=False,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise ValueError("The provider returned no structured output.")
        result = parsed.model_dump(mode="json")
        if safety_violations(result):
            raise ValueError("Generated output did not pass the deterministic safety filter.")
        usage = response.usage
        cache = AIResponseCache(
            cache_key=key,
            feature=feature,
            alert_id=alert.id,
            model=settings.openai_model,
            prompt_version=prompt_version,
            response_payload=result,
            input_tokens=usage.input_tokens if usage else 0,
            output_tokens=usage.output_tokens if usage else 0,
            openai_request_id=getattr(response, "_request_id", None),
            safety_status="approved",
            expires_at=now + timedelta(minutes=settings.ai_cache_ttl_minutes),
        )
        session.add(cache)
        await session.commit()
        return {
            "feature": feature,
            "source": "openai",
            "cached": False,
            "model": settings.openai_model,
            "prompt_version": prompt_version,
            "result": result,
            "uncertainty": result["uncertainty"],
        }
    except Exception:
        result = fallback.model_dump(mode="json")
        return {
            "feature": feature,
            "source": "deterministic_fallback",
            "cached": False,
            "model": settings.openai_model,
            "prompt_version": prompt_version,
            "result": result,
            "uncertainty": result["uncertainty"],
        }
