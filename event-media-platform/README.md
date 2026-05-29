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

**Google OAuth**

1. Browser: `GET /api/v1/auth/google` (or click **Continue with Google** on login/register).
2. User consents on Google; Google redirects to `GOOGLE_CALLBACK_URL`.
3. API finds or creates the user (`googleId` / email link), sets the same JWT cookies, and
   redirects to `{WEB_BASE_URL}/dashboard`.
4. The app layout calls `GET /auth/me` (cookie auth) to hydrate the client session.

Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `.env`.

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
      access + refresh rotation, theft detection, RBAC middleware, **Google OAuth**
- [x] Transactional email via **Resend** (verify, password reset, weekly digest queue)
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
- [x] Selfie upload + face matching: `POST /users/me/selfie` (presigned →
      Rekognition `index_faces` + `search_faces_by_image`), face-to-user
      matching in the worker → "you were detected in a photo" notifications
- [x] EXIF extraction in worker (Sharp `metadata().exif` → camera/lens/ISO +
      decimal GPS), persisted to `media.exif` / `gpsLatitude` / `gpsLongitude`
- [x] HEIC→JPEG conversion in worker (iPhone uploads, `heic-convert`)
- [x] Video poster/duration hook (ffmpeg via `fluent-ffmpeg` + `ffmpeg-static`,
      graceful when ffmpeg is unavailable)
- [x] Virus-scan hook (ClamAV INSTREAM, pluggable + graceful no-op in dev)
- [x] Bulk ZIP download (`POST /media/download-zip`, `archiver`) + multi-select UI
- [x] Frontend: landing, login, register, dashboard, upload (drag-drop +
      presigned + progress), events list + detail, **media detail
      (`/media/:id`: likes, comments, tags, EXIF/GPS, share, watermark download)**,
      my-photos, favourites, notifications, profile edit + selfie, 404
- [x] **Admin dashboard** (`/admin` overview + charts, `/admin/users` role
      management, `/admin/media` moderation queue) with Recharts
- [x] **PWA**: web manifest + service worker (app-shell + offline gallery image
      caching) + offline fallback page
- [x] **i18n**: i18next + react-i18next baseline (English + Hindi) with in-app
      language switcher
- [x] Docker compose stack, multi-stage Dockerfiles, GitHub Actions CI

### Recently completed
- [x] Events CRUD UI (`/events/new`, `/events/:id/edit`) + albums section, sort/filter
- [x] Clubs UI: list, detail (events/members/about), manage (roles, invite, settings)
- [x] `/albums/:id` gallery with reusable `InfiniteGallery` + full-screen `Lightbox`
- [x] `/search` page + global `SearchBar` (debounced quick results, URL-synced filters)
- [x] Upload UX: searchable event/album pickers, inline album create, duplicate warning
- [x] Public profile `/u/:username` + photographer portfolio `/photographer/:username` (PDF)
- [x] Admin `/admin/events` (filters + bulk delete) and `/admin/analytics` (Recharts)
- [x] QR sharing (`QRModal` + `/qr/:id` landing), TagPicker, WatermarkPreview, inline caption edit
- [x] Collaborative albums panel; Stories: backend CRUD + `Story` table + `StoryViewer` + create modal
- [x] **Photo map** view (`/events/:id/map`, react-leaflet) using persisted EXIF GPS
- [x] **Full H.264 video transcode** in worker (`-crf 23`, faststart) + poster frame
- [x] **Weekly-digest cron** (`node-cron`, Sunday 09:00 IST) in the worker process
- [x] Keyboard shortcuts help modal (`?`); architecture + DB-schema docs under `docs/`
- [x] Production deployment guide (`docs/deployment.md`) + `.env.example`

### Next up
- [ ] Expand i18n coverage to every remaining page (infra + nav + key flows done).
- [ ] Generate PNG app icons (a vector `icon.svg` ships today).
- [ ] Stand up the live demo URL and record it here (see `docs/deployment.md`).

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

## Email (Resend)

Transactional email runs through the **Resend** SDK (`resend` npm package) and a
BullMQ `email` worker.

| Trigger | Template | When |
|---------|----------|------|
| Register | `verify-email` | Queued after account creation |
| `POST /auth/forgot-password` | `password-reset` | 1-hour reset link |
| Weekly digest | `weekly-digest` | `node-cron` in the worker, every Sunday 09:00 IST (per-user idempotency key) |

Configure in `.env`:

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=EMP <notifications@yourdomain.com>
```

- Get an API key at [resend.com/api-keys](https://resend.com/api-keys).
- Verify your domain at [resend.com/domains](https://resend.com/domains) and use
  that domain in `EMAIL_FROM` for production.
- For local testing only, you can use `EMP <onboarding@resend.dev>` and send to
  Resend test addresses like `delivered@resend.dev`.

If `RESEND_API_KEY` is missing, jobs are still queued but the worker logs a skip
(no crash) so the rest of the app keeps working.

---

## Media pipeline add-ons

All of the following are **graceful** — they enhance processing when their
dependency/credentials are present and silently no-op otherwise.

| Feature | How to enable | Falls back to |
|---|---|---|
| Face → user matching | AWS Rekognition creds + `REKOGNITION_COLLECTION_ID` | faces indexed, no user link |
| EXIF + GPS | always on (`exif-reader`) | empty EXIF for stripped images |
| HEIC → JPEG | always on (`heic-convert`) | original kept if convert fails |
| Video poster/duration | `npm i fluent-ffmpeg ffmpeg-static -w @emp/api` (or system ffmpeg) | no poster generated |
| Virus scanning | `VIRUS_SCAN_ENABLED=true` + `CLAMAV_HOST`/`CLAMAV_PORT` | every file treated as clean |
| Bulk ZIP download | always on (`archiver`) | — |

```env
# Optional virus scanning (ClamAV daemon, INSTREAM protocol)
VIRUS_SCAN_ENABLED=false
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
```

## Selfie face match

1. `POST /users/me/selfie/presigned-url` → presigned PUT into the private
   selfies bucket.
2. Browser uploads the selfie directly to S3.
3. `POST /users/me/selfie` with the returned `s3Key` → indexes the face,
   searches the collection, links every matching media face to the user, and
   surfaces them under **My photos**.

Wired into `/profile/edit` (selfie card). Without Rekognition the selfie is
stored and matching activates automatically once newer photos are processed.

## PWA & i18n

- **PWA**: `public/manifest.json` + `public/sw.js` (registered in production via
  `PwaRegister`). The service worker precaches the app shell and runtime-caches
  thumbnails/processed images for an offline gallery, with an `/offline` fallback.
- **i18n**: `src/lib/i18n` initialises i18next (English + Hindi) with browser
  language detection; toggle languages from the navbar globe button.

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

AWS / OpenAI / Resend keys are **optional**: if missing, those steps in the worker are
skipped with a debug log so you can develop locally without cloud accounts.

---

## License

Private — for the BRD owner.
