# Architecture — Event & Media Management Platform

A monorepo (npm workspaces) with three packages:

- `apps/web` — Next.js (App Router) frontend, React Query + Zustand, Tailwind, Socket.io client, PWA.
- `apps/api` — Express + Prisma API, JWT auth, BullMQ producers, Socket.io server.
- `packages/shared` — Zod schemas, enums and types shared by both apps.

## System diagram

```mermaid
graph TD
  Browser["Browser (Next.js PWA)"] -->|HTTPS| CDN[CloudFront CDN]
  Browser -->|REST + WS| API[Express API Server]
  CDN --> S3[(AWS S3 Buckets)]
  API --> PG[(PostgreSQL)]
  API --> Redis[(Redis Cache + Queue)]
  API --> Queue[BullMQ Workers]
  Queue --> Rekognition[AWS Rekognition]
  Queue --> OpenAI[GPT-4o Vision]
  Queue --> Sharp[Sharp Image Processor]
  Queue --> FFmpeg[ffmpeg Transcode]
  Queue --> ClamAV[ClamAV Virus Scan]
  Queue --> S3
  API --> Socket[Socket.io Server]
  Socket --> Browser
  API --> Resend[Resend Email]
```

## Request / upload flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant S as S3
  participant Q as BullMQ Worker
  participant W as WebSocket

  B->>A: POST /media/presigned-url
  A-->>B: { uploadUrl, s3Key }
  B->>S: PUT file (direct upload)
  B->>A: POST /media/upload (finalize)
  A->>Q: enqueue media-processing job
  A-->>B: 202 { media, uploadJobId }
  Q->>Q: virus scan, HEIC→JPEG, compress, thumbnail, pHash
  Q->>Q: AI caption + tags, Rekognition face index
  Q->>S: store processed / thumbnail / watermarked
  Q->>W: emit upload:complete
  W-->>B: toast "Upload processed"
  B->>A: GET /media/upload-status/:jobId (poll fallback)
```

## Key flows

- **Auth** — JWT access token (short-lived) + refresh token (HttpOnly cookie). Google OAuth supported. RBAC via `ROLE_LEVEL` (VIEWER < CLUB_MEMBER < PHOTOGRAPHER < ADMIN).
- **Media pipeline** — direct-to-S3 presigned upload, then a BullMQ worker compresses (Sharp), generates thumbnails, computes a perceptual hash for dedup, extracts EXIF/GPS, runs AI captioning/tagging (OpenAI) and face indexing (Rekognition), transcodes video + poster (ffmpeg), and watermarks on download.
- **Real-time** — Socket.io pushes `notification:new`, `upload:complete`, and `upload:progress` events; the frontend shows toasts and invalidates React Query caches.
- **Search** — `/search` over media (aiTags GIN index, caption, event/album/uploader names), events and users.
- **Storage** — five private S3 buckets (original, processed, watermarked, avatars, selfies); browser access via presigned GET URLs or CloudFront when configured.

## Deployment topology

| Layer    | Local (dev)            | Production (suggested)              |
| -------- | ---------------------- | ----------------------------------- |
| Frontend | `next dev` :3000       | Vercel                              |
| API      | `tsx watch` :4000      | Railway / Render / EC2 (Docker)     |
| Worker   | `tsx watch` worker     | Railway background worker           |
| Postgres | Docker `postgres`      | Railway / Neon / RDS                |
| Redis    | Docker `redis`         | Railway / Upstash                   |
| Storage  | AWS S3 (or MinIO)      | AWS S3 + CloudFront                 |

See [`database-schema.md`](./database-schema.md) for the data model.
