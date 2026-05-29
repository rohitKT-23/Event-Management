# Production Deployment

This guide covers two deployment paths. **Option A** (managed PaaS) is the
fastest way to get a public demo URL. **Option B** (Docker on a single VPS)
gives you full control and runs the whole stack with one command.

All environment variables are documented in [`.env.example`](../.env.example).
The same root `.env` feeds both the API and the web app.

---

## Architecture recap

```
Vercel (Next.js web)  ─REST+WS─▶  Railway (Express API)  ─▶  Railway PostgreSQL
                                          │                  Railway Redis
                                          └── Railway Worker (BullMQ + cron) ─▶ AWS S3 / Rekognition / OpenAI
```

The API and the **worker** are separate processes that share the same image:

- API: `node dist/index.js`
- Worker: `node dist/worker.js` (media pipeline, watermarking, email queue, weekly digest cron)

---

## Option A — Vercel + Railway (free tier)

### 1. Provision data stores on Railway

1. Create a new Railway project.
2. Add the **PostgreSQL** plugin → copy its `DATABASE_URL`.
3. Add the **Redis** plugin → copy its `REDIS_URL`.

### 2. Deploy the API service

1. New service → **Deploy from GitHub repo** → select this repo.
2. Settings:
   - **Root directory**: repository root (monorepo build).
   - **Build command**: `npm ci && npm run build -w @emp/shared && npm run build -w @emp/api`
   - **Start command**: `npm run prisma:migrate:deploy -w @emp/api && node apps/api/dist/index.js`
3. Add all API env vars from `.env.example` (DATABASE_URL, REDIS_URL, the two JWT
   secrets, AWS keys, RESEND_API_KEY, etc.). Set:
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `CORS_ORIGINS=https://<your-vercel-domain>`
   - `WEB_BASE_URL=https://<your-vercel-domain>`
4. Note the public API URL Railway assigns, e.g. `https://emp-api.up.railway.app`.

### 3. Deploy the worker service

1. New service in the **same project** → same repo.
2. **Start command**: `node apps/api/dist/worker.js`
3. Reuse the same env vars as the API service (Railway lets you reference shared variables).

> The worker runs the BullMQ consumers **and** the weekly email-digest cron
> (`Sunday 09:00 Asia/Kolkata`). Only run **one** worker instance to avoid
> duplicate digests, or rely on the per-user idempotency key already built in.

### 4. Deploy the web app on Vercel

1. Import the repo in Vercel.
2. **Root directory**: `apps/web`.
3. Environment variables:
   - `NEXT_PUBLIC_API_URL=https://emp-api.up.railway.app/api/v1`
   - `NEXT_PUBLIC_WS_URL=https://emp-api.up.railway.app`
   - `NEXT_PUBLIC_WEB_URL=https://<your-vercel-domain>`
   - `NEXT_PUBLIC_CDN_URL=https://<cloudfront-domain>` (optional)
4. Deploy. Vercel handles `npm run build` for the Next.js app automatically.

### 5. Seed sample data (once)

From any machine with the production `DATABASE_URL` exported:

```bash
npm run prisma:seed -w @emp/api
```

This creates one admin user, sample events, and sample media references.

---

## Option B — Docker on a single VPS

Requirements: a Linux box (DigitalOcean $6 droplet / EC2 t3.micro) with Docker
and the Docker Compose plugin.

```bash
git clone <repo> && cd event-media-platform
cp .env.example .env        # then edit with production values
# Build + start everything (postgres, redis, minio, api, worker, web)
docker compose --profile full up -d --build
# Apply database migrations
docker compose exec api npm run prisma:migrate:deploy -w @emp/api
# Seed sample data
docker compose exec api npm run prisma:seed -w @emp/api
```

The web app is served on port `3000`, the API on `4000`. Put Nginx or Caddy in
front for TLS, pointing `your-domain.com` → `web:3000` and
`/api` + `/socket.io` → `api:4000`.

For production you'll typically swap the bundled MinIO for real AWS S3 — just
leave the MinIO service out and set the real `AWS_*` / `S3_BUCKET_*` vars.

---

## Post-deploy checklist

- [ ] `DATABASE_URL` reachable; migrations applied (`prisma migrate deploy`).
- [ ] `REDIS_URL` reachable from both API and worker.
- [ ] `COOKIE_SECURE=true` and `CORS_ORIGINS` set to the real web origin.
- [ ] JWT secrets are strong (`openssl rand -hex 32`) and **not** the defaults.
- [ ] S3 buckets exist and the IAM key has `s3:*` on them + Rekognition access.
- [ ] `RESEND_API_KEY` set and sending domain verified for transactional email.
- [ ] One (and only one) worker instance running for the digest cron.
- [ ] Update the live demo URL in the project README.
