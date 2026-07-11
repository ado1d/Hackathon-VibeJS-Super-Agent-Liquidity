# Deploy to Render with OpenAI Enabled

This guide deploys the synthetic-data demo from the `ui-fix` branch as three Render resources:

1. Render Postgres
2. FastAPI backend web service
3. React/Nginx frontend web service

The frontend calls `/api/v1` on its own origin. Nginx then proxies that request to the backend's public Render URL. This is necessary on the free tier because free web services cannot receive private-network traffic.

## 1. Prerequisites

- GitHub repository access.
- A Render account connected to GitHub.
- An OpenAI Platform API key with API billing/credits enabled.
- The corrected `ui-fix` branch pushed to GitHub.

Keep the API key private. Do not place it in `.env.example`, `render.yaml`, a Vite variable, GitHub, screenshots, or chat. `render.yaml` declares `OPENAI_API_KEY` with `sync: false`, so Render prompts for the secret without committing it.

The configured AI model is `gpt-5.4-mini`, using the Responses API and Pydantic structured outputs. The application sends only allow-listed synthetic alert fields and sets `store=false`.

## 2. Review the Blueprint

The root [render.yaml](../render.yaml) currently specifies:

- Branch: `ui-fix`
- Region: Singapore
- Postgres: free, PostgreSQL 16
- Backend and frontend: free web services
- AI: enabled
- Model: `gpt-5.4-mini`
- API key: prompted as a secret
- Auto-deploy: only after linked checks pass

If you merge `ui-fix` into `main`, update both `branch: ui-fix` entries to `branch: main` before syncing the Blueprint.

## 3. Create the Blueprint

1. Sign in to the [Render Dashboard](https://dashboard.render.com/).
2. Select **New +** and then **Blueprint**.
3. Connect `ado1d/Hackathon-VibeJS-Super-Agent-Liquidity`.
4. Select the `ui-fix` branch if Render asks which branch contains the Blueprint.
5. Confirm Render detects `render.yaml`.
6. When prompted for `OPENAI_API_KEY`, paste the key from the OpenAI Platform.
7. Apply the Blueprint.

Render creates:

- `super-agent-db`
- `super-agent-backend`
- `super-agent-frontend`

The backend container automatically runs Alembic migrations, seeds the healthy baseline only when the database is empty, and then starts Uvicorn on Render's assigned `PORT`.

## 4. Connect the frontend proxy

Render cannot insert another free web service's public URL into a Blueprint variable automatically. The initial frontend therefore uses `https://placeholder.invalid` and its `/api` calls return `502` until this one-time step is completed.

1. Open `super-agent-backend` in Render.
2. Copy its public URL, for example:

   ```text
   https://super-agent-backend-abcd.onrender.com
   ```

3. Open `super-agent-frontend` and select **Environment**.
4. Set `BACKEND_URL` to that URL with no trailing slash.
5. Choose **Save and deploy**.

The frontend entrypoint validates the URL, preserves Nginx's own runtime variables, derives the backend hostname for TLS SNI and the HTTP `Host` header, and generates the final Nginx configuration.

## 5. Set the exact frontend origin

The same-origin proxy does not require browser CORS for normal application traffic. Still, configure the backend correctly if you use its public API or Swagger UI from a browser:

1. Copy the frontend URL, for example:

   ```text
   https://super-agent-frontend-wxyz.onrender.com
   ```

2. Open `super-agent-backend` and select **Environment**.
3. Replace `CORS_ORIGINS=https://placeholder.invalid` with the exact frontend origin.
4. Do not add a trailing slash.
5. Choose **Save and deploy**.

For multiple trusted origins, use a comma-separated list.

## 6. Verify backend and database health

Set local shell variables to your real URLs:

```bash
BACKEND=https://super-agent-backend-abcd.onrender.com
FRONTEND=https://super-agent-frontend-wxyz.onrender.com
```

Then verify:

```bash
curl -fsS "$BACKEND/api/v1/health"
curl -fsS "$BACKEND/api/v1/ready"
curl -fsS "$FRONTEND/healthz"
```

Expected responses include:

```json
{"status":"ok"}
```

```json
{"status":"ready","database":"reachable"}
```

If readiness fails, inspect the backend deploy log for migration or database connection errors. Render supplies a `postgresql://` connection string; the application normalizes it to SQLAlchemy's async `postgresql+psycopg://` form.

## 7. Verify authentication and load a scenario

Open the frontend URL and sign in as:

```text
username: admin
password: demo-pass
```

Then:

1. Open **Demo control**.
2. Load Scenario B or D.
3. Open **Operations** from the sidebar.
4. Open an alert.

The credentials are synthetic demo credentials and are intentionally public. Do not position this deployment as a production or regulated system. Restrict or remove public access if the scenario controls should not be available to everyone.

## 8. Verify OpenAI configuration

First obtain a JWT without printing the API key:

```bash
TOKEN=$(curl -fsS -X POST "$BACKEND/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo-pass"}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
```

Check status:

```bash
curl -fsS "$BACKEND/api/v1/ai/status" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

```json
{
  "enabled": true,
  "model": "gpt-5.4-mini",
  "features": ["translate", "summarize", "recommendations"],
  "core_workflows_available": true
}
```

Status proves that the feature flag and key are present. To prove that a live provider call succeeds:

1. Load Scenario B in the UI.
2. Open an alert as Admin, Operations, or Risk.
3. Click **Summarize** or **Advisory steps**.
4. Inspect the displayed source.

The source must be `openai` on the first successful call. `cache` is valid on subsequent identical calls. `deterministic_fallback` means the application remained safe, but the live OpenAI request failed or its output did not pass validation/safety filtering.

## 9. AI environment variables

Configure these only on `super-agent-backend`:

| Variable | Render value |
| --- | --- |
| `AI_ENABLED` | `true` |
| `OPENAI_API_KEY` | Secret value entered in Render |
| `OPENAI_MODEL` | `gpt-5.4-mini` |
| `AI_MAX_OUTPUT_TOKENS` | `500` |
| `AI_TIMEOUT_SECONDS` | `12` |
| `AI_CACHE_TTL_MINUTES` | `60` |
| `AI_INPUT_COST_PER_MILLION` | `0.75` |
| `AI_OUTPUT_COST_PER_MILLION` | `4.50` |
| `AI_PRICING_VERSION` | `openai-gpt-5.4-mini-2026-07-11` |

Pricing fields are reporting configuration, not billing enforcement. Confirm current OpenAI pricing before future deployments and update the rates and version label together.

Never create a variable such as `VITE_OPENAI_API_KEY`. Vite values are compiled into browser assets and are public.

## 10. Troubleshooting

### Frontend returns 502 for `/api`

- Confirm `BACKEND_URL` is the backend's public HTTPS URL.
- Remove any trailing slash.
- Confirm backend health succeeds directly.
- Redeploy the frontend after changing the value.

### Frontend container does not start

Check its logs for entrypoint validation errors. `BACKEND_URL` must start with `http://` or `https://`, and `PORT` must be numeric.

### AI status is disabled

- Confirm `AI_ENABLED=true`.
- Confirm `OPENAI_API_KEY` exists on the backend service and is not blank.
- Use **Save and deploy** after changing the environment.

### AI result uses `deterministic_fallback`

- Confirm the OpenAI account has API billing/credits and model access.
- Confirm `OPENAI_MODEL=gpt-5.4-mini`.
- Inspect backend logs for timeouts or provider status errors.
- Confirm the structured response was not rejected by the deterministic safety filter.

The fallback is expected reliability behavior and is never cached as a provider result.

### Backend migration fails

- Confirm `DATABASE_URL` comes from `super-agent-db` through `fromDatabase`.
- Confirm the database has not expired.
- Inspect the first failing Alembic revision in backend logs.

### Login receives 429

The limits are five login attempts per minute per client IP and 50 authenticated API requests per minute per JWT subject. Wait for the `Retry-After` duration. Do not disable rate limiting on a public deployment.

## 11. Free-tier limitations

As of July 2026:

- A free web service spins down after 15 minutes without inbound HTTP or WebSocket activity and can take about one minute to start again.
- Free web services share 750 workspace instance hours per month.
- A free Postgres database has 1 GB storage and expires after 30 days, followed by a limited upgrade grace period.
- Free Postgres has no backups or managed connection pooling.
- The filesystem is ephemeral; `data/validation/latency.json` does not persist across restarts.
- OpenAI API usage is billed separately from Render and `gpt-5.4-mini` is not available on the OpenAI API free tier.

For a stable demonstration, use paid always-on web services and paid Postgres, or schedule the demo soon after deployment and preserve exported evidence elsewhere.

## 12. Rollback and key rotation

Render free web services retain only the two most recent previous deploys for rollback. To roll back, open the service's **Deploys** page and select a known-good deploy.

If an OpenAI key is ever exposed:

1. Revoke it immediately in the OpenAI Platform.
2. Create a replacement key.
3. Update `OPENAI_API_KEY` on the backend only.
4. Redeploy the backend.
5. Review OpenAI usage for unexpected calls.

## Can Codex deploy it directly?

Deployment requires access to your Render workspace, linked GitHub repository, billing choices, and secret API key entry. Without an authenticated Render session or scoped Render API token, Codex cannot create resources on your behalf. After those credentials are configured locally, the Render CLI/API can be used, but the OpenAI key should still be entered directly into Render rather than shared in chat.

## Official references

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Render Docker deployments](https://render.com/docs/docker)
- [Render environment variables and secrets](https://render.com/docs/configure-environment-variables)
- [Render free-tier limitations](https://render.com/docs/free)
- [OpenAI GPT-5.4 mini model details](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
