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
from app.models import AIResponseCache, Alert

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


def safety_violations(value: Any) -> list[str]:
    """Return matched unsafe-action categories without echoing generated text."""
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return [pattern.pattern for pattern in _UNSAFE_PATTERNS if pattern.search(text)]


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
        from openai import AsyncOpenAI, OpenAIError

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
    except (OpenAIError, ValueError):
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
