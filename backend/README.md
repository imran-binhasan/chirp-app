# Mini Social Feed — Backend API

REST API powering the Mini Social Feed app: JWT auth, text posts, likes & comments
with real-time FCM push notifications.

**Stack:** Node.js 20+ · Express 5 · TypeScript (strict) · Prisma 6 · PostgreSQL 16 ·
Zod 4 · pino · Vitest/Supertest · firebase-admin

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Database design](#database-design)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [API documentation](#api-documentation)
- [Response envelope](#response-envelope)
- [Pagination](#pagination)
- [Authentication & security](#authentication--security)
- [Push notifications (FCM)](#push-notifications-fcm)
- [Performance notes](#performance-notes)
- [Testing](#testing)

---

## Features

- **Auth** — signup / login (email *or* username) with **JWT access tokens (15 min)** +
  **rotating refresh tokens (30 d, hashed at rest)**. Reuse of a rotated token revokes
  the whole session family (theft detection).
- **Posts** — text-only (max **2000** chars), **cursor-paginated feed newest-first**,
  optional **username filter**, `likedByMe` per viewer with a single batched query.
- **Likes** — idempotent **toggle**; `@@unique(userId, postId)` makes it race-proof at
  the DB level; counters are denormalized & transactional (O(1) reads).
- **Comments** — max **1000** chars, newest-first, cursor-paginated.
- **Push** — FCM notifications on like/comment, fire-and-forget, dead-token pruning,
  graceful no-op when Firebase isn't configured.
- **Uniform response envelope** on every endpoint, **requestId** correlation ids,
  OpenAPI spec generated from the validation schemas.

## Architecture

Layered, feature-module layout — each module is a self-contained unit
(`routes → controller → service → Prisma`). No DI containers, no over-abstraction:
Prisma **is** the data layer.

```
backend/
├── docker-compose.yml            # Postgres 16 (dev) + isolated test DB (tmpfs)
├── prisma/
│   ├── schema.prisma             # source of truth for the data model
│   └── migrations/               # SQL migrations (apply with prisma migrate)
├── src/
│   ├── server.ts                 # bootstrap + graceful shutdown
│   ├── app.ts                    # express assembly (also used by tests)
│   ├── routes.ts                 # /api/v1 aggregator
│   ├── config/env.ts             # zod-validated env, fail-fast at boot
│   ├── lib/                      # prisma, logger (pino), password (argon2id),
│   │                             # jwt (sign/verify + sha256 token hashing), firebase
│   ├── common/
│   │   ├── errors/app-error.ts   # AppError hierarchy (400/401/403/404/409)
│   │   ├── response.ts           # sendSuccess / sendError — the uniform envelope
│   │   ├── pagination.ts         # opaque keyset cursor encode/decode
│   │   ├── async-handler.ts      # no try/catch noise in controllers
│   │   ├── validation-utils.ts   # trim-before-validate helper
│   │   └── middleware/           # requestId, validate, authenticate, rate-limit,
│   │                             #   not-found, error-handler (central)
│   ├── modules/
│   │   ├── auth/                 # signup/login/refresh/logout/me
│   │   ├── posts/                # posts + likes + comments
│   │   ├── devices/              # FCM token registration
│   │   └── notifications/        # fire-and-forget FCM delivery
│   ├── docs/                     # DTOs + OpenAPI generation (from zod schemas)
│   └── types/                    # Express type augmentation
└── tests/                        # integration tests (Vitest + Supertest)
```

## Database design

```mermaid
erDiagram
    users ||--o{ posts : authors
    users ||--o{ likes : gives
    users ||--o{ comments : writes
    users ||--o{ refresh_tokens : owns
    users ||--o{ device_tokens : owns
    posts ||--o{ likes : receives
    posts ||--o{ comments : has

    users {
        uuid id PK
        text username UK "lowercased"
        text email UK "lowercased"
        text passwordHash "argon2id"
        timestamp createdAt
    }
    posts {
        uuid id PK
        uuid authorId FK
        text content "max 2000"
        int likeCount "denormalized"
        int commentCount "denormalized"
        timestamp createdAt
    }
    likes {
        uuid id PK
        uuid userId FK
        uuid postId FK
        timestamp createdAt
    }
    comments {
        uuid id PK
        uuid postId FK
        uuid authorId FK
        text content "max 1000"
        timestamp createdAt
    }
    refresh_tokens {
        uuid id PK
        uuid userId FK
        text tokenHash UK "sha256"
        timestamp expiresAt
        timestamp revokedAt
        text replacedById
    }
    device_tokens {
        uuid id PK
        uuid userId FK
        text token UK "FCM token"
        text platform
        timestamp lastSeenAt
    }
```

Indexes are built for the query patterns:

- `posts (createdAt DESC, id)` — keyset cursor seeks for the feed
- `posts (authorId, createdAt DESC)` — username feed filter
- `likes (userId, postId)` **unique** — idempotent, race-proof like toggle
- `comments (postId, createdAt DESC, id)` — newest-first comment pagination
- `refresh_tokens (tokenHash)` unique, `device_tokens (token)` unique — O(log n) lookups

## Getting started

### 1. Prerequisites

- Node.js 20+ (Node 22 recommended)
- Docker + Docker Compose (for PostgreSQL) — *or* any PostgreSQL 14+ you have

### 2. Start the database

```bash
cd backend
cp .env.example .env          # then fill in JWT secrets (min 32 chars each)
docker compose up -d          # starts Postgres (5432) + isolated test DB (5433)
```

### 3. Install, migrate, run

```bash
npm install
npm run prisma:deploy         # apply migrations (equivalent to `npx prisma migrate deploy`)
npm run dev                   # http://localhost:4000
```

Verify: `curl http://localhost:4000/health`

Swagger UI: **http://localhost:4000/api/docs** — raw spec: `/api/docs.json`

> **No Docker?** Point `DATABASE_URL` at any PostgreSQL instance and run
> `npm run prisma:deploy`. For tests, set `TEST_DATABASE_URL` (defaults to the
> `postgres_test` compose service on port 5433).

## Scripts

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Dev server with auto-restart (tsx watch)      |
| `npm run build`          | Compile TypeScript → `dist/`                  |
| `npm start`              | Run the compiled build                        |
| `npm run lint`           | ESLint                                        |
| `npm run typecheck`      | Type-check `src` **and** `tests`              |
| `npm test`               | Integration tests (Vitest)                    |
| `npm run prisma:deploy`  | Apply migrations to the configured database   |
| `npm run db:up` / `db:down` | Start / stop the Docker databases          |

## API documentation

Interactive docs (generated from the zod validation schemas — they cannot drift from
the code): **`GET /api/docs`**.

Base path: `/api/v1`. All authenticated endpoints require
`Authorization: Bearer <accessToken>`.

| Method | Path                    | Auth | Description                                  |
| ------ | ----------------------- | ---- | -------------------------------------------- |
| POST   | `/auth/signup`          | —    | Create account (username, email, password)    |
| POST   | `/auth/login`           | —    | Log in with email **or** username            |
| POST   | `/auth/refresh`         | —    | Rotate token pair (reuse → revoke all)       |
| POST   | `/auth/logout`          | —    | Revoke a refresh token (idempotent)          |
| GET    | `/auth/me`              | ✔    | Current user                                 |
| POST   | `/posts`                | ✔    | Create post (max 2000 chars)                 |
| GET    | `/posts`                | ✔    | Feed, newest-first, `?limit&cursor&username` |
| GET    | `/posts/:id`            | ✔    | Single post (+ `likedByMe`)                  |
| POST   | `/posts/:id/like`       | ✔    | Toggle like → `{ liked, likeCount }`         |
| POST   | `/posts/:id/comments`   | ✔    | Add comment (max 1000 chars)                 |
| GET    | `/posts/:id/comments`   | ✔    | Comments, newest-first, `?limit&cursor`      |
| GET    | `/notifications`        | ✔    | Your inbox, newest-first, `?limit&cursor`    |
| GET    | `/notifications/unread-count` | ✔ | Unread total for the tab badge            |
| POST   | `/notifications/read`   | ✔    | Mark all as read (idempotent)                |
| POST   | `/devices`              | ✔    | Register an FCM device token                 |
| DELETE | `/devices/:token`       | ✔    | Unregister a device token on logout          |
| GET    | `/health`               | —    | Liveness + DB check                          |

`GET /notifications` is deliberately side-effect free — reading your inbox does not
mark it read. The client calls `POST /notifications/read` when it decides the user
has actually seen the list, which keeps GET safe to retry, prefetch and cache.

### Example — signup

```http
POST /api/v1/auth/signup
Content-Type: application/json

{ "username": "JaneDoe", "email": "jane@example.com", "password": "password1" }
```

```jsonc
{
  "success": true,
  "data": {
    "user": { "id": "9de0ac16-...", "username": "janedoe",
              "email": "jane@example.com", "createdAt": "2026-08-13T04:51:00.197Z" },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ...",
                "accessTokenExpiresIn": 900, "refreshTokenExpiresIn": 2592000 }
  },
  "error": null,
  "meta": { "requestId": "7e57a03f-...", "timestamp": "2026-08-13T04:51:00.207Z" }
}
```

### Example — feed

```http
GET /api/v1/posts?limit=2&username=janedoe
Authorization: Bearer eyJ...
```

```jsonc
{
  "success": true,
  "data": [
    { "id": "4228ecb2-...", "content": "My first post!", "likeCount": 1, "commentCount": 1,
      "createdAt": "2026-08-13T04:51:00.909Z",
      "author": { "id": "9de0ac16-...", "username": "janedoe" },
      "likedByMe": true }
  ],
  "error": null,
  "meta": { "requestId": "27359b84-...", "timestamp": "2026-08-13T04:51:01.230Z",
            "pagination": { "nextCursor": "eyJjIjoiMjAyNi0...", "hasMore": true, "limit": 2 } }
}
```

## Response envelope

**Every** endpoint — success or error — uses the same shape:

```jsonc
// Success (2xx)
{ "success": true,  "data": { ... }, "error": null,
  "meta": { "requestId": "...", "timestamp": "...", "pagination": { ... } /* lists only */ } }

// Error (4xx/5xx)
{ "success": false, "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [ { "field": "email", "message": "Invalid email address" } ] },
  "meta": { "requestId": "...", "timestamp": "..." } }
```

`meta.requestId` is echoed in the `X-Request-Id` response header and every log line —
pass it to us with any bug report.

### Error codes

| HTTP | `code`                | Meaning                                        |
| ---- | --------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Request body/query/params failed zod checks    |
| 400  | `BAD_JSON`            | Body is not valid JSON                         |
| 401  | `UNAUTHORIZED`        | Missing/invalid/expired token or credentials   |
| 403  | `FORBIDDEN`           | Authenticated but not allowed                  |
| 404  | `NOT_FOUND`           | Resource (or route) not found                  |
| 409  | `CONFLICT`            | Duplicate username/email, etc.                 |
| 429  | `RATE_LIMITED`        | Too many requests                              |
| 500  | `INTERNAL_ERROR`      | Unexpected server error (sanitized)            |

## Pagination

All list endpoints are **cursor-paginated** (not offset). The cursor is an opaque
base64url token encoding `(createdAt, id)` of the last item:

```text
?limit=20&cursor=<nextCursor from the previous response>
```

- `limit` default **20**, max **50**
- `meta.pagination` → `{ nextCursor, hasMore, limit }`; `nextCursor: null` = last page
- Keyset seeks use the composite indexes → **O(log n + limit)** per page, no offset
  drift when new posts are inserted mid-scroll (mobile-friendly)

## Authentication & security

Flow used by the mobile app:

1. `signup` / `login` → returns `user` + `{ accessToken, refreshToken, ...expiresIn }`
2. Send `accessToken` as `Authorization: Bearer` on every request (stateless, O(1) verify)
3. When access expires (~15 min), call `auth/refresh` with the refresh token → new pair,
   old one revoked. Store tokens in **Expo SecureStore** on-device.
4. `logout` revokes the refresh token (idempotent). Also call `DELETE /devices/:token`.

Security posture (OWASP-aligned):

| Area                     | Measure                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Passwords                | **argon2id** hashing; policy ≥8 chars, letter + number, max 72          |
| Tokens                   | Access 15 min, refresh 30 d; refresh **hashed (sha256) at rest**, rotated per use |
| Token theft              | Reuse of a rotated refresh token → revoke the user's **entire session family** |
| Enumeration              | Generic `Invalid credentials`; unique conflict errors only on signup    |
| Injection                | Prisma (parameterized) everywhere; zod validates every input            |
| Headers                  | `helmet`, `X-Request-Id`, `x-powered-by` disabled                       |
| CORS                     | Configurable allowlist via `CORS_ORIGINS` (not `*` in production)       |
| Brute force              | Rate limits: global + stricter bucket on `/auth/*`                      |
| Secrets                  | Env validated at boot (fail-fast); `.env` gitignored; secrets never logged |
| Error leakage            | Central handler sanitizes 5xx in production (stack traces dev-only)     |
| Dependencies             | `npm audit` clean on production deps (verified)                         |

## Push notifications (FCM)

Likes and comments on **someone else's post** trigger a push to all of the author's
registered devices. Self-actions are skipped. Delivery is **fire-and-forget**: an FCM
failure never fails the like/comment request.

### Setup

1. Create a Firebase project → Project settings → **Service accounts** → **Generate new
   private key** (JSON).
2. Add the three fields to `.env` (keep the key on one line, `\n` escapes intact):

   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. Restart the server. Watch the log for `Firebase Admin initialised`.
4. The mobile app registers its FCM token via `POST /devices` after login.

Without credentials the API runs normally and simply logs a debug line instead of
sending pushes — nothing breaks. Dead/unregistered tokens are pruned automatically.

## Performance notes

- Feed & comments use keyset-seeked pagination — **O(log n + limit)**, no `COUNT(*)`
  (the `limit + 1` probe tells us whether another page exists).
- `likeCount` / `commentCount` are denormalized, updated in the **same transaction**
  as the write → **O(1)** reads on feed cards.
- `likedByMe` for a whole page is **one** batched `IN` query (no N+1).
- Auth middleware is stateless — zero DB hits per request.
- Every hot-path lookup runs on a unique/composite index.

## Testing

```bash
npm test
```

35 integration tests against a real PostgreSQL (Vitest + Supertest): auth flows
(rotation, reuse-detection, logout idempotency), post creation & validation, cursor
pagination correctness (no overlaps / no gaps), username filtering, like-toggle
idempotency and per-viewer `likedByMe`, comments newest-first, notification
fan-out (self-actions excluded, unlike does not re-notify, per-user isolation,
read/unread lifecycle), and envelope/status-code assertions.

Tests run against the isolated `postgres_test` container (port 5433, tmpfs) and reset
the database between cases. To point them elsewhere:

```bash
TEST_DATABASE_URL=postgresql://user:pass@host:5432/db npm test
```

---

**Docs drift prevention:** the Swagger UI spec at `/api/docs` is generated at boot
from the same zod schemas that validate incoming requests, so documented **request**
shapes cannot drift from what the API accepts. **Response** shapes are declared in
`src/docs/dto.ts` and mirror the Prisma selects in `src/modules/users/user.select.ts`
— change a select, change the DTO beside it.
