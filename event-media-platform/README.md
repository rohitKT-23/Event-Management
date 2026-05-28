# EMP — Event & Media Management Platform

A production-grade, full-stack platform for clubs, photographers, and members to
upload, organise, discover, and interact with event media.

This repository implements the BRD ([`../brd.txt`](../brd.txt)) as a TypeScript
monorepo: a Next.js 14 web app, an Express + Prisma API, a BullMQ worker, and
a shared types/schemas package.

---

## Highlights

- **Next.js 14 (App Router)** frontend with Tailwind + shadcn-style primitives,
  React Query, Zustand, dark mode, drag-and-drop uploads, and a Socket.io client.
- **Express + TypeScript + Prisma** API with JWT access/refresh rotation,
  role-based access control, Zod validation, structured logging (pino),
  rate limiting on Redis, Swagger UI at `/docs`, and a fail-fast env config.
- **PostgreSQL** schema covering every table in the BRD (users, clubs,
  memberships, events, albums, media, faces, social, notifications, analytics,
  RSVP).
- **AWS S3** integration with presigned-URL uploads (browser → S3 direct),
  separate buckets for original/processed/watermarked/avatars/selfies.
  MinIO is wired up in `docker-compose.yml` for local dev without AWS.
- **BullMQ** workers for:
  - Media post-processing (compression, thumbnail, pHash dedup, Rekognition
    labels + moderation + face indexing, GPT-4o captions).
  - Watermarked-download rendering with Sharp composites.
- **Socket.io** push notifications (likes, comments, tags, face matches,
  upload progress).
- **PostgreSQL full-text search** across media tags/captions, events, users
  with a single `/api/v1/search` endpoint.
- **Docker compose** stack for postgres + redis + minio + api + worker + web.
- **GitHub Actions CI** running lint → typecheck → build against ephemeral
  postgres + redis services.

---

## Tech decisions (and why)

| Layer | Choice | Why |
|---|---|---|
| Backend | Node 20 + Express + TypeScript | Single language with the frontend, native Sharp/BullMQ ecosystem, easy worker process. |
| Database | PostgreSQL via Prisma | Rich schema + migrations + type-safe queries; `tsvector`/array ops for search. |
| Queue | BullMQ on Redis | First-class TypeScript, retries, concurrency, observable via Redis. |
| Object storage | S3 + (optional) CloudFront | Industry standard, presigned URLs for direct browser upload. MinIO for local dev. |
| Auth | JWT (15m access + 7d refresh, rotation, hashed refresh in DB) | Stateless, sessions revocable, theft detection on hash mismatch. |
| Realtime | Socket.io | JWT handshake auth, room-per-user, mature client. |
| Search | Postgres `ILIKE` + `aiTags` GIN index (baseline) | Zero new infrastructure; swap in Meili/Elastic later. |
| Frontend state | Zustand (client) + React Query (server) | Clear separation, no provider-soup. |

---

## Repository layout

```
event-media-platform/
├── apps/
│   ├── api/                      # Express + Prisma API + BullMQ workers
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Full schema (15+ models)
│   │   │   └── seed.ts           # Admin + sample club + event
│   │   └── src/
│   │       ├── config/env.ts     # Zod-validated env
│   │       ├── lib/              # prisma, redis, logger, errors, tokens, http
│   │       ├── middleware/       # auth, validate, error, rateLimit, requestId
│   │       ├── modules/
│   │       │   ├── auth/         # register, login, refresh, logout, me, reset
│   │       │   ├── users/        # me, favourites, uploads, notifications, my-photos
│   │       │   ├── clubs/        # CRUD + memberships
│   │       │   ├── events/       # CRUD + filters + albums + media + QR
│   │       │   ├── albums/       # CRUD + collaborators
│   │       │   ├── media/        # presigned-url, upload, status, download
│   │       │   ├── social/       # likes, comments (threaded), shares, tags, favourites
│   │       │   ├── search/       # smart search across media/events/users
│   │       │   ├── ai/           # retag, regenerate-caption, moderation queue
│   │       │   ├── analytics/    # overview, per-event, top media
│   │       │   └── admin/        # users, role changes, media moderation
│   │       ├── services/         # s3, queue, socket, notifications
│   │       ├── workers/          # mediaProcessing + watermark BullMQ workers
│   │       ├── app.ts            # Express factory
│   │       ├── server.ts         # HTTP + Socket.io entry
│   │       └── worker.ts         # Worker process entry
│   └── web/                      # Next.js 14 App Router frontend
│       └── src/
│           ├── app/
│           │   ├── page.tsx          # Landing
│           │   ├── (auth)/           # login, register
│           │   ├── (public)/         # events list + detail
│           │   └── (app)/            # dashboard, upload, my-photos, favourites, notifications, profile
│           ├── components/
│           │   ├── ui/               # button, input, card, label
│           │   ├── providers.tsx     # ThemeProvider + QueryClientProvider + Toaster
│           │   └── navbar.tsx
│           ├── lib/                  # api (axios + refresh), utils, queryClient
│           └── stores/               # zustand auth store
├── packages/shared/                  # zod schemas, enums, types reused on both sides
├── docker-compose.yml                # postgres, redis, minio (+ api/worker/web with --profile full)
├── .env.example                      # Every env var documented
├── tsconfig.base.json
└── .github/workflows/ci.yml          # Lint + typecheck + build with services
```

---

## Quick start

### Prerequisites
- **Node** 20+
- **npm** 10+
- **Docker** (or local PostgreSQL 16 + Redis 7)

### 1. Install
```bash
cp .env.example .env       # fill in JWT_*_SECRET; rest works with defaults
npm install
```

### 2. Start infra
```bash
docker compose up -d postgres redis minio
```
- Postgres → `localhost:5432`
- Redis    → `localhost:6379`
- MinIO    → `http://localhost:9000` (console: `http://localhost:9001`)

### 3. Migrate & seed
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```
Seed creates `admin@emp.local` / `Admin@1234` (ADMIN) and a sample club + event.

### 4. Dev
```bash
npm run dev
```
Runs the API (`:4000`), web (`:3000`), and the worker concurrently with hot reload.

- Web app: <http://localhost:3000>
- API: <http://localhost:4000>
- Swagger: <http://localhost:4000/docs>
- Healthcheck: <http://localhost:4000/health>

---

## Auth flow

1. `POST /api/v1/auth/register` or `/login` returns `{ user, accessToken }` and
   sets two HttpOnly cookies:
   - `access_token` (15m, path `/`)
   - `refresh_token` (7d, path `/api/v1/auth`)
2. The axios client sends `withCredentials: true` so cookies travel with every
   request.
3. On any `401`, the axios interceptor calls `POST /auth/refresh`, replays the
   queued request, and rotates the refresh token (hashed in DB; family-revoke
   on hash mismatch as theft mitigation).
4. `POST /auth/logout` revokes the active refresh token.

---

## Upload flow (presigned-URL pattern)

1. Browser: `POST /api/v1/media/presigned-url` → returns `{ uploadUrl, s3Key }`.
2. Browser: `PUT` the file directly to `uploadUrl` (bypasses the API).
3. Browser: `POST /api/v1/media/upload` with `{ s3Key, filename, contentType, size }`.
4. API creates the `media` row (`uploadStatus = PROCESSING`) and enqueues a
   `media-processing` job with `jobId = media.id`.
5. Worker downloads, compresses, thumbnails, pHash-dedups, runs Rekognition
   (labels + moderation + face indexing) and OpenAI captioning, updates the row,
   and emits `upload:complete` over Socket.io to the uploader's room.

---

## Implementation status

This is **phase 1**. Architecture, all DB models, all primary REST endpoints,
both async pipelines (media processing + watermark), the realtime layer, and a
working frontend (landing, auth, dashboard, events, upload, my-photos,
favourites, notifications, profile) are wired together. The pieces below are
scaffolded with TODO markers and are next on the list.

### Done
- [x] Monorepo: npm workspaces + shared package
- [x] Prisma schema for every BRD table (users, clubs, memberships, events,
      albums, collaborators, media, faces, selfies, social — likes/comments/shares/
      favourites/tags/downloads, notifications, analytics, RSVP)
- [x] Auth: register, login, logout, refresh, me, forgot/reset password, JWT
      access + refresh rotation, theft detection, RBAC middleware
- [x] CRUD: users, clubs, club memberships, events, albums, collaborators, media
- [x] Media: presigned PUT URLs, finalize, status polling, S3 service, daily
      upload quota tracked in Redis
- [x] BullMQ producers + workers for media processing + watermark rendering
- [x] Social: likes, comments (threaded with soft-delete), shares, favourites,
      tag-with-coords, downloads
- [x] Search: cross-resource search endpoint with pagination
- [x] Realtime: Socket.io with JWT handshake, per-user rooms, notification
      service that persists + pushes
- [x] Admin endpoints: list users, role change, moderation queue
- [x] Analytics endpoints: overview, per-event, top media
- [x] Frontend: landing, login, register, dashboard, upload (drag-drop +
      presigned + progress), events list + detail, my-photos, favourites,
      notifications, profile edit, 404
- [x] Docker compose stack, multi-stage Dockerfiles, GitHub Actions CI

### Next up (clearly stubbed in code — search "TODO" or "stub")
- [ ] Google OAuth (`/auth/google`) — schema + endpoints stubbed.
- [ ] Email transactional (verify, reset, weekly digest) — `emailQueue`
      created, SMTP env vars defined; handler stub awaits implementation.
- [ ] Selfie upload endpoint (`POST /users/me/selfie`) — DB model + UI present;
      Rekognition search_faces_by_image call to be added.
- [ ] Media detail page (`/media/:id`) — backend exists; UI page to be added.
- [ ] Admin dashboard (`/admin/*`) — backend exists; UI pages to be added.
- [ ] PWA: `next-pwa` config + service worker + offline gallery caching.
- [ ] EXIF extraction step in worker (Sharp `metadata().exif` → parse + persist).
- [ ] Video transcoding pipeline (ffmpeg) — only image processing today.
- [ ] HEIC→JPEG conversion in worker.
- [ ] Bulk ZIP download (archiver).
- [ ] i18next setup.
- [ ] Virus scanning hook.

---

## Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | API + web + worker concurrently with hot reload |
| `npm run dev:api` / `dev:web` / `dev:worker` | Run a single process |
| `npm run build` | Build all workspaces (shared → api → web) |
| `npm run typecheck` | TypeScript across the monorepo |
| `npm run lint` | ESLint across the monorepo |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Apply migrations (dev) |
| `npm run prisma:seed` | Seed admin + sample data |
| `npm run docker:up` / `docker:down` | Start/stop the dev stack |

---

## Environment

Every secret + setting lives in `.env`. See `.env.example` for the full list.
The API parses it through Zod at boot and dies loudly if anything is missing
or wrong — no `undefined` leaks into request handlers.

The minimum to boot in dev:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` (≥ 16 chars)
- `JWT_REFRESH_SECRET` (≥ 16 chars)

AWS / OpenAI keys are **optional**: if missing, those steps in the worker are
skipped with a debug log so you can develop locally without cloud accounts.

---

## License

Private — for the BRD owner.
