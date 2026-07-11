# AI Integration

The optional AI layer ships three review-assistance features: Bengali/Banglish translation, concise alert summarization, and advisory recommendations. It does not participate in forecasting, anomaly detection, alert creation, state transitions, or financial actions. The platform remains useful when AI is disabled or offline.

## Provider and interface

- Official asynchronous OpenAI Python SDK.
- Responses API with Pydantic structured outputs.
- Configurable model; the demo default is `gpt-5.4-mini`.
- `store=false` on every provider request.
- Provider timeout defaults to 12 seconds with no SDK retry; timeout, rate-limit, transport, provider, parsing, and safety failures return a deterministic safe fallback.

Implementation references: [Responses API text generation](https://developers.openai.com/api/docs/guides/text), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [model catalog](https://developers.openai.com/api/docs/models), and the [official Python SDK](https://github.com/openai/openai-python).

The OpenAI SDK is imported only inside the enabled provider path, so disabled/offline startup does not initialize it.

## Data boundary

Only an allow-listed synthetic alert object is sent: type, severity, status, summary, reason, structured evidence, confidence and reasons, data-quality state, uncertainty, and recommended next step. Credentials, user records, customer data, notes, audit events, request metadata, and unrestricted database content are excluded.

## Structured schemas

- Translation: language, summary, reason, uncertainty, recommended next step, human-review flag.
- Summary: headline, situation, up to five evidence points, uncertainty, next step, human-review flag.
- Recommendations: up to five advisory actions, prohibited actions, uncertainty, human-review flag.

Prompts require advisory language, human review, explicit uncertainty, and no fraud declaration, account blocking/freezing, accusation, guilt statement, or automatic transfer.

## Deterministic safety layer

Provider output must pass Pydantic validation and a deterministic phrase filter. Rejected provider text is never cached or returned; the caller receives a safe structured fallback. Fifty table-driven regression cases cover unsafe declaration and action phrasings. Safe “not proof of fraud” and human-review wording remains permitted.

## Cache and cost accounting

Migration `0002` creates `ai_response_cache`. The SHA-256 key covers feature, model, prompt version, and canonical structured context. Approved results expire after the configured TTL. Cache hits update hit count and last-access time.

Actual input/output token counts and provider request IDs are stored for approved provider responses. `/api/v1/admin/ai-usage` reports totals, cache hits, and estimated USD cost using operator-configured rates plus a pricing-version label. Zero/unconfigured rates are explicit; the application does not silently embed current provider pricing.

## Endpoints and permissions

- `GET /api/v1/ai/status`: any authenticated role.
- `POST /api/v1/alerts/{id}/translate?lang=bn|banglish`: any role allowed to view the alert.
- `POST /api/v1/alerts/{id}/summarize`: any role allowed to view the alert.
- `POST /api/v1/alerts/{id}/recommendations`: Operations, Risk, or Admin with normal alert scoping.
- `GET /api/v1/admin/ai-usage`: Admin only.

When disabled, status returns `enabled: false`, feature controls are hidden, and feature endpoints return the standard `503 AI_DISABLED` envelope.

## Evaluation and deferred work

CI runs deterministic schema and safety tests without a key. A live-model compliance evaluation is optional, must be deliberately enabled, and may incur cost. Free-form Q&A and AI note handover remain deferred until live evaluation demonstrates acceptable data-boundary, safe-language, and structured-output compliance.
