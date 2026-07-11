# Render Deployment Guide

> Deploy the Super Agent Liquidity Platform to Render in ~15 minutes.

---

## Prerequisites

- A GitHub account with push access to the repo
- A Render account (sign up at <https://render.com> with GitHub)
- (Optional) An OpenAI API key if you want AI features

---

## Architecture on Render

```
┌──────────────────────────────────────────────────────────┐
│  Render                                                   │
│                                                           │
│  ┌──────────────────┐         ┌────────────────────┐     │
│  │  Web Service     │  ─────▶ │  PostgreSQL        │     │
│  │  (backend)       │         │  (managed, free)   │     │
│  │  FastAPI + Uvicorn│        │                    │     │
│  │  Port 8000       │         └────────────────────┘     │
│  └──────────────────┘                                    │
│           ▲                                              │
│           │  proxies /api/*                              │
│  ┌──────────────────┐                                    │
│  │  Web Service     │                                    │
│  │  (frontend)      │                                    │
│  │  Nginx + Vite SPA│                                    │
│  │  Port 8080       │                                    │
│  └──────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

Three services:
1. **PostgreSQL** — managed database (free tier, 90 days)
2. **Backend** — Docker container running FastAPI
3. **Frontend** — Docker container running Nginx that serves the SPA and proxies API calls to the backend

---

## Step 1 — Push the code to GitHub

Make sure these files are in your repo:

```
render.yaml                          ← Render Blueprint
backend/Dockerfile                   ← Backend container
backend/.dockerignore                ← Keeps backend image small
frontend/Dockerfile                  ← Frontend container (uses nginx.conf.template)
frontend/.dockerignore               ← Keeps frontend image small
frontend/nginx.conf.template         ← Nginx config with ${BACKEND_URL} placeholder
.env.example                         ← Reference for all env vars
```

If you just cloned this zip, commit and push:

```bash
cd Hackathon-VibeJS-Super-Agent-Liquidity
git add -A
git commit -m "deploy: add render.yaml, .dockerignore, nginx template, UI improvements"
git push origin main
```

---

## Step 2 — Create the Render Blueprint

1. Go to <https://dashboard.render.com>
2. Sign in with GitHub
3. Click **New +** → **Blueprint**
4. Select your repository: `ado1d/Hackathon-VibeJS-Super-Agent-Liquidity`
5. Render detects `render.yaml` and shows 3 resources:
   - `super-agent-db` (PostgreSQL, free)
   - `super-agent-backend` (Web Service, free)
   - `super-agent-frontend` (Web Service, free)
6. Click **Apply**

Render provisions the database first (~2 min), then builds and deploys the backend (~5 min), then the frontend (~4 min).

---

## Step 3 — Get your service URLs

After all 3 services show **Live** status:

1. Open **super-agent-backend** → copy the URL (e.g. `https://super-agent-backend-abc123.onrender.com`)
2. Open **super-agent-frontend** → copy the URL (e.g. `https://super-agent-frontend-xyz789.onrender.com`)

You'll need these for the next step.

---

## Step 4 — Connect the frontend to the backend

The frontend Nginx needs to know where the backend is.

1. Open **super-agent-frontend** → **Environment**
2. Find the `BACKEND_URL` variable
3. Change it from `http://backend:8000` to your actual backend URL:
   ```
   https://super-agent-backend-abc123.onrender.com
   ```
4. Save → Render redeploys the frontend automatically

### Also update CORS on the backend

1. Open **super-agent-backend** → **Environment**
2. Find `CORS_ORIGINS`
3. Change it from `*` to your frontend URL:
   ```
   https://super-agent-frontend-xyz789.onrender.com
   ```
4. Save → the backend restarts automatically

---

## Step 5 — Verify the deployment

```bash
# Replace with your actual URLs
BACKEND=https://super-agent-backend-abc123.onrender.com
FRONTEND=https://super-agent-frontend-xyz789.onrender.com

# 1. Backend health check
curl $BACKEND/api/v1/health
# Expected: {"status":"ok"}

# 2. Backend database check
curl $BACKEND/api/v1/ready
# Expected: {"status":"ready","database":"reachable"}

# 3. Login
curl -X POST $BACKEND/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo-pass"}'
# Expected: {"access_token":"...","user":{...}}

# 4. Frontend loads
curl -sI $FRONTEND | head -1
# Expected: HTTP/2 200
```

Open the frontend URL in your browser:
1. Sign in as `admin` / `demo-pass`
2. Go to **Demo control**
3. Click **Load Scenario D**
4. Go back to **Home** → see alerts in the priority queue
5. Click an alert → claim → acknowledge → escalate → resolve
6. Sign out, sign in as `risk` → see the escalated alert

If all of that works, you're live. 🎉

---

## Step 6 — (Optional) Enable AI features

1. Open **super-agent-backend** → **Environment**
2. Set `AI_ENABLED` to `true`
3. Set `OPENAI_API_KEY` to your OpenAI key (`sk-...`)
4. Set `OPENAI_MODEL` to `gpt-4o-mini` (cheapest, ~$0.15/M tokens)
5. Save → backend restarts

Verify AI is enabled:
```bash
curl -H "Authorization: Bearer <your-token>" $BACKEND/api/v1/ai/status
# Expected: {"enabled":true,"model":"gpt-4o-mini","features":["translate","summarize","recommendations"]}
```

Now when you open an alert, you'll see an **AI-assisted explanation** panel with three buttons: Translate, Summarize, Advisory steps.

---

## Step 7 — (Optional) Set up auto-deploy

By default, Render auto-deploys when you push to `main`. To change this:

1. Open each service → **Settings** → **Auto-Deploy**
2. Toggle on/off as needed
3. You can also create a **Pull Request Preview** environment: **Settings** → **Pull Request Previews** → enable

---

## Cost on Render Free Tier

| Resource | Free tier | What happens when exceeded |
|---|---|---|
| Web Service (backend) | 750 hours/month, sleeps after 15 min idle | First request after sleep takes ~30s to wake |
| Web Service (frontend) | 750 hours/month, sleeps after 15 min idle | Same |
| PostgreSQL | 90 days free, then $7/month | Database pauses; email warnings at 80/90 days |
| Bandwidth | 100 GB/month combined | Soft cap — Render emails you |
| Builds | 500 minutes/month | Soft cap |

**Total for hackathon demo: $0**

For always-on production: upgrade both web services to **Starter** ($7/month each = $14/month) + managed Postgres ($7/month) = **$21/month**.

---

## Troubleshooting

### "Backend won't start — migration fails"

The `DATABASE_URL` must start with `postgresql+psycopg://` (not `postgres://`). Render's "connectionString" property outputs `postgres://` — the `render.yaml` Blueprint handles this automatically by using `fromDatabase`, but if you set it manually, prefix it correctly.

**Fix:** Check **super-agent-backend** → **Environment** → `DATABASE_URL`. It should look like:
```
postgresql+psycopg://super_agent:password@host:5432/super_agent
```

### "Frontend loads but API calls return 502"

The frontend Nginx can't reach the backend. Check:

1. `BACKEND_URL` env var on the frontend service is set to the **public** backend URL (not `http://backend:8000`)
2. The backend is actually running (check **super-agent-backend** → **Logs**)
3. The backend URL has no trailing slash

### "CORS error in browser console"

The frontend origin isn't in the backend's `CORS_ORIGINS` list.

**Fix:** Set `CORS_ORIGINS` on the backend to your exact frontend URL:
```
https://super-agent-frontend-xyz789.onrender.com
```
No trailing slash. Comma-separated for multiple origins.

### "401 Unauthorized on every API call"

Your JWT expired (8-hour lifetime) or the backend restarted with a new `JWT_SECRET`.

**Fix:** Sign out and sign back in.

### "429 Too Many Requests"

You hit the rate limit (50 API calls/minute, or 5 login attempts/minute).

**Fix:** Wait 60 seconds. For demo purposes, you can temporarily set `RATE_LIMIT_ENABLED=false` on the backend.

### "AI features return 503"

AI is not configured. Either:
- `AI_ENABLED=false` (default)
- `OPENAI_API_KEY` is empty
- `OPENAI_MODEL` is set to a non-existent model (must be `gpt-4o-mini`, `gpt-4o`, or `gpt-4-turbo`)

**Fix:** Set all three env vars on the backend and restart.

### "Backend sleeps and the first request is slow"

Render free tier sleeps web services after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up.

**Fix:** Upgrade to **Starter** plan ($7/month) for always-on. Or use a free uptime monitor like <https://uptimerobot.com> to ping `/api/v1/health` every 10 minutes and keep the service warm.

### "Database will expire in 90 days"

Render's free PostgreSQL is free for 90 days only. After that it pauses.

**Fix:** Upgrade to a paid Postgres plan ($7/month), or redeploy on a fresh Render account, or migrate to a self-hosted VPS.

---

## Environment Variables Reference

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (auto-set by Render) |
| `JWT_SECRET` | ✅ | — | JWT signing secret (auto-generated by Render Blueprint) |
| `APP_ENV` | ❌ | `demo` | `production` for deployed environments |
| `CORS_ORIGINS` | ✅ | `*` | Comma-separated allowed origins (set to your frontend URL) |
| `AI_ENABLED` | ❌ | `false` | `true` to enable OpenAI features |
| `OPENAI_API_KEY` | ❌ | — | Required if `AI_ENABLED=true` |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Valid: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo` |
| `RATE_LIMIT_ENABLED` | ❌ | `true` | Set `false` to disable rate limiting |
| `RATE_LIMIT_TRUST_PROXY_HEADERS` | ❌ | `true` | Trust `X-Forwarded-For` (needed on Render) |
| `BACKEND_URL` | ✅ (frontend) | `http://backend:8000` | The backend's public URL, used by Nginx |
| `VITE_API_BASE` | ❌ | `/api/v1` | API base path (built into the SPA at build time) |

---

## Manual Deployment (without Blueprint)

If you prefer to create services manually instead of using `render.yaml`:

### 1. Create PostgreSQL

1. **New +** → **PostgreSQL**
2. Name: `super-agent-db`
3. Plan: **Free**
4. Database: `super_agent`, User: `super_agent`
5. Save the **Internal Database URL** — you'll need it

### 2. Create Backend Web Service

1. **New +** → **Web Service**
2. Connect your GitHub repo
3. Name: `super-agent-backend`
4. Runtime: **Docker**
5. Dockerfile Path: `./backend/Dockerfile`
6. Docker Build Context: `./backend`
7. Plan: **Free**
8. Health Check Path: `/api/v1/health`
9. Environment variables:
   - `DATABASE_URL` → paste the Internal Database URL from step 1, but change `postgres://` to `postgresql+psycopg://`
   - `JWT_SECRET` → generate with `openssl rand -hex 32`
   - `CORS_ORIGINS` → `*` (update later)
   - `AI_ENABLED` → `false`
   - `RATE_LIMIT_ENABLED` → `true`
   - `RATE_LIMIT_TRUST_PROXY_HEADERS` → `true`
10. Create Web Service

### 3. Create Frontend Web Service

1. **New +** → **Web Service**
2. Same GitHub repo
3. Name: `super-agent-frontend`
4. Runtime: **Docker**
5. Dockerfile Path: `./frontend/Dockerfile`
6. Docker Build Context: `./frontend`
7. Plan: **Free**
8. Environment variables:
   - `BACKEND_URL` → your backend's public URL from step 2
   - `VITE_API_BASE` → `/api/v1`
9. Create Web Service

### 4. Update CORS

After both services are live, update `CORS_ORIGINS` on the backend to your frontend URL.

---

## Rollback

Render keeps every deployment. To roll back:

1. Open the service → **Deploys**
2. Find the last known-good deploy
3. Click **Roll back to this deploy**

This takes ~30 seconds and doesn't require a rebuild.

---

## What's Next

After deployment:

1. Read **USAGE.md** for the full end-user guide
2. Read **docs/demo-script.md** for the 7-9 minute judge demo script
3. Read **docs/responsible-design.md** for the safety constraints
4. Read **docs/prd-compliance-matrix.md** for the PDF requirement compliance map
