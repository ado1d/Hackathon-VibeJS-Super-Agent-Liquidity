# Deploying SALI to Vercel

## Prerequisites

1. A [Vercel](https://vercel.com) account (free tier works)
2. A [GitHub](https://github.com) account with this repo pushed
3. An [OpenAI API key](https://platform.openai.com/api-keys)

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "SALI — Super Agent Liquidity & Risk Intelligence Platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sali.git
git push -u origin main
```

## Step 2: Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `sali` repo
4. Vercel auto-detects Next.js — keep the defaults

## Step 3: Configure Environment Variables

In the Vercel project settings → **Environment Variables**, add:

| Name | Value | Environments |
|------|-------|:---:|
| `DATABASE_URL` | `file:./db/custom.db` | Production + Preview |
| `OPENAI_API_KEY` | `sk-your-openai-key-here` | Production + Preview |

> **Note:** SQLite uses a local file. Vercel's serverless functions have an ephemeral filesystem — the database resets on each cold start. For the hackathon demo this is fine. For production you'd switch to Postgres (see below).

## Step 4: Override Build Settings

In Vercel project settings → **Build & Development Settings**:

- **Build Command:** `npm run build` (or `bun run build`)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm install` (or `bun install`)

> If using `bun`, add a `vercel.json` at the project root:
> ```json
> {
>   "functions": {
>     "src/app/api/**/route.ts": { "memory": 512 }
>   }
> }
> ```

## Step 5: Handle the Realtime Service

The realtime mini-service (`mini-services/realtime/`) runs on a separate port (3001) and **cannot run on Vercel** (Vercel is serverless, no long-running processes).

### Option A: Disable realtime (simplest for demo)
The app works without the realtime service — the dashboard just won't auto-update. The user can click the Refresh button manually.

To disable: the app already gracefully handles no-socket connections (shows "Offline" instead of "Live").

### Option B: Deploy realtime separately (recommended)
Deploy the realtime service to a free host like [Railway](https://railway.app) or [Render](https://render.com):

1. Create a new project on Railway
2. Connect the same GitHub repo
3. Set root directory to `mini-services/realtime/`
4. Set start command to `bun run dev`
5. Add environment variable `DATABASE_URL` pointing to the same SQLite file (or share a Postgres URL)
6. Railway gives you a URL like `https://sali-realtime.up.railway.app`
7. Update the frontend socket connection in `src/hooks/use-realtime.ts` to use that URL

### Option C: Use Vercel's Edge Functions (advanced)
Rewrite the realtime service as a Vercel Edge Function with SSE (Server-Sent Events) instead of Socket.io. This is more work but keeps everything on Vercel.

## Step 6: Handle the Database (Important)

SQLite (`file:./db/custom.db`) works locally but **resets on Vercel** because serverless functions are stateless. Two options:

### Option A: Auto-seed on cold start (easiest for hackathon demo)
The app already calls `seedDatabase()` on every API request if the DB is empty. So on Vercel, the first request after a cold start will auto-seed. Data won't persist between requests if the function spins down, but it will always have data.

### Option B: Switch to Postgres (production-ready)
1. Create a free [Supabase](https://supabase.com) or [Neon](https://neon.tech) Postgres database
2. Update `prisma/schema.prisma` — change `provider = "sqlite"` to `provider = "postgresql"`
3. Run `bun run db:push` to create the tables
4. Set `DATABASE_URL` in Vercel to the Postgres connection string
5. The seed function works the same — it will seed Postgres on first request

## Step 7: Deploy

Click **"Deploy"** on Vercel. The build takes ~2-3 minutes. Vercel gives you a URL like:
```
https://sali-your-username.vercel.app
```

## Step 8: Verify

1. Open the Vercel URL
2. You should see the SALI login page
3. Log in as any role
4. The AI Assistant should work (uses your OpenAI key)
5. The TTS voice output should work (uses your OpenAI key)
6. The dashboard data will auto-seed on first load

## Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created from GitHub repo
- [ ] `OPENAI_API_KEY` set in Vercel env vars
- [ ] `DATABASE_URL` set in Vercel env vars
- [ ] Build succeeds on Vercel
- [ ] Login page loads
- [ ] AI Assistant responds (OpenAI)
- [ ] TTS works (OpenAI)

## Troubleshooting

### "Cannot find module 'openai'"
Run `npm install openai` or `bun add openai` and push the updated `package.json`.

### AI Assistant says "fallback"
Check that `OPENAI_API_KEY` is set in Vercel environment variables and the key is valid.

### Database is empty after refresh
This is expected with SQLite on Vercel (ephemeral filesystem). The app auto-seeds on each cold start. For persistent data, switch to Postgres (Step 6, Option B).

### Realtime connection shows "Offline"
The Socket.io mini-service can't run on Vercel. Either deploy it separately (Step 5, Option B) or accept manual refresh for the demo.

### Build fails with Prisma error
Add a `postinstall` script in `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```
This ensures Prisma Client is generated during the Vercel build.
