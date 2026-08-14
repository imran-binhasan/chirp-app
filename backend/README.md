# Mini Social Feed — Backend

REST API for the Mini Social Feed app powering user authentication, posts, likes, comments, and real-time FCM push notifications.

**Repository:** [https://github.com/imran-binhasan/chirp-app](https://github.com/imran-binhasan/chirp-app)

## Tech Stack
Node.js 20+ • Express 5 • TypeScript (strict) • Prisma 6 • PostgreSQL 16 • Zod 4 • Vitest

## ✅ Completed Requirements
- [x] Signup/Login using JWT (includes rotating refresh tokens hashed at rest).
- [x] POST `/posts` for text-only posts (validated via Zod).
- [x] GET `/posts` paginated feed (cursor-based to prevent offset drift).
- [x] POST `/posts/:id/like` and `/posts/:id/comments` (race-proof transactions).
- [x] Firebase Cloud Messaging (FCM) integration for interaction notifications.

## 📂 Folder Structure
Clean feature-module architecture with separated concerns:
```text
src/
├── app.ts / server.ts / routes.ts   # Entry points & Express assembly
├── common/                          # Middleware, standardized responses, pagination logic
├── config/                          # Zod-validated environment variables
├── docs/                            # Auto-generated OpenAPI specs
├── lib/                             # Core utilities (Prisma, Firebase, JWT, Logger)
├── modules/                         # Isolated feature modules:
│   ├── auth/                        # - Login/signup, token rotation, session management
│   ├── devices/                     # - FCM device token registration
│   ├── notifications/               # - Push delivery & inbox processing
│   └── posts/                       # - Posts, likes, comments, and feed retrieval
└── types/                           # Express request augmentation
```

## 🚀 Quick Start

1. **Database Setup:**
```bash
cp .env.example .env          # Set your JWT secrets (min 32 chars)
docker compose up -d          # Starts PostgreSQL container on port 5432
```

2. **Run the API:**
```bash
npm install
npm run prisma:deploy         # Apply database schema
npm run prisma:seed           # Optional: 60 users, 120 posts, likes and comments
npm run dev                   # Starts dev server on http://localhost:4000
```

Every seeded account shares the password `Password123!` — log in as `demo` to browse a
populated feed immediately. Seeding is additive, so re-run it against a fresh database
(`npm run db:down && npm run db:up`) if you want a clean set.

3. **FCM Push Notifications (Required for Push):**
Add your Firebase credentials to `.env`:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 📖 API Documentation

Base URL: **`/api/v1`**. An interactive OpenAPI page is generated from the same Zod schemas that
validate requests — so it cannot drift from the implementation — and is served at
**`http://localhost:4000/api/docs`** (raw spec at `/api/docs.json`).

### Response envelope
Every endpoint, success or failure, answers in one shape:

```jsonc
// success
{ "success": true,  "data": { }, "error": null, "meta": { "requestId": "…", "timestamp": "…" } }
// failure
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "…",
  "details": [{ "field": "email", "message": "Invalid email address" }] }, "meta": { } }
```

List endpoints add `meta.pagination`: `{ nextCursor, hasMore, limit }`.

### Authentication
Send the access token as `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes;
refresh tokens last 30 days, are stored only as a SHA-256 hash, and rotate on every use.

### Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | :---: | --- |
| `POST` | `/auth/signup` | — | Create an account, returns the user and a token pair |
| `POST` | `/auth/login` | — | Log in with **email or username**, returns a token pair |
| `POST` | `/auth/refresh` | — | Rotate the token pair |
| `POST` | `/auth/logout` | — | Revoke a refresh token (idempotent) |
| `GET` | `/auth/me` | ✔ | The authenticated user |
| `POST` | `/posts` | ✔ | Create a text-only post (≤ 2000 chars) |
| `GET` | `/posts` | ✔ | Feed, newest first, cursor-paginated, `?username=` filter |
| `GET` | `/posts/{id}` | ✔ | A single post |
| `POST` | `/posts/{id}/like` | ✔ | Like or unlike a post |
| `POST` | `/posts/{id}/comment` | ✔ | Add a comment (≤ 1000 chars) |
| `POST` | `/posts/{id}/comments` | ✔ | Alias of the above |
| `GET` | `/posts/{id}/comments` | ✔ | Comments, newest first, cursor-paginated |
| `POST` | `/devices` | ✔ | Register an FCM device token for push |
| `DELETE` | `/devices` | ✔ | Unregister a device token on logout |
| `GET` | `/notifications` | ✔ | In-app inbox, newest first, cursor-paginated |
| `GET` | `/notifications/unread-count` | ✔ | Unread badge count |
| `POST` | `/notifications/{id}/read` | ✔ | Mark one notification read |
| `POST` | `/notifications/read` | ✔ | Mark all read |
| `GET` | `/health` | — | Liveness plus database reachability (not under `/api/v1`) |

### Query parameters

| Parameter | Applies to | Notes |
| --- | --- | --- |
| `limit` | all list endpoints | 1–50, default 20 |
| `cursor` | all list endpoints | Opaque token from `meta.pagination.nextCursor` |
| `username` | `GET /posts` | Case-insensitive author filter |

### Worked example

```bash
# 1. Sign up (or log in) and keep the access token
TOKEN=$(curl -s -X POST localhost:4000/api/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"username":"jane","email":"jane@example.com","password":"password1"}' \
  | jq -r .data.tokens.accessToken)

# 2. Post
POST_ID=$(curl -s -X POST localhost:4000/api/v1/posts \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Hello world"}' | jq -r .data.id)

# 3. Read the feed (newest first), optionally filtered by author
curl -s "localhost:4000/api/v1/posts?limit=20&username=jane" -H "authorization: Bearer $TOKEN"

# 4. Like, then comment
curl -s -X POST "localhost:4000/api/v1/posts/$POST_ID/like" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"liked":true}'
curl -s -X POST "localhost:4000/api/v1/posts/$POST_ID/comment" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Nice one"}'
```

### Request bodies

| Endpoint | Body |
| --- | --- |
| `POST /auth/signup` | `{ username, email, password }` — username 3–30 chars `[A-Za-z0-9_]`; password 8–72 chars with a letter and a digit |
| `POST /auth/login` | `{ identifier, password }` — `identifier` is an email **or** a username |
| `POST /auth/refresh`, `/auth/logout` | `{ refreshToken }` |
| `POST /posts` | `{ content }` |
| `POST /posts/{id}/like` | `{ liked?: boolean }` — omit to toggle, send explicitly for retry-safety |
| `POST /posts/{id}/comment` | `{ content }` |
| `POST /devices` | `{ token, platform: "android" \| "ios" \| "web" }` |
| `DELETE /devices` | `{ token }` |

### Error codes

`VALIDATION_ERROR` (400) · `BAD_JSON` (400) · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) ·
`NOT_FOUND` (404) · `CONFLICT` (409) · `RATE_LIMITED` (429) · `INTERNAL_ERROR` (500)

### Notifications
Liking or commenting on **someone else's** post writes an inbox row and sends that author an FCM
push. You are never notified about your own actions, and re-liking a post the author has already
been told about does not notify again. Push delivery is fire-and-forget: an FCM outage never fails
the request that triggered it, and tokens FCM reports as dead are pruned automatically.

## 🧪 Testing
The suite includes integration tests running against a real, isolated PostgreSQL tmpfs instance. Start the test database first, then run the suite:
```bash
docker compose up -d postgres_test
npm test
```

## Production notes

- Set explicit `CORS_ORIGINS` in production; wildcard CORS is rejected at startup.
- Set `TRUST_PROXY` to the number of reverse proxies actually in front of the API (0 when it is
  exposed directly). Trusting `X-Forwarded-For` when nothing rewrites it lets any client forge its
  own IP and walk past the per-IP rate limiter.
- Run migrations as a deployment step (`npm run prisma:deploy`) before starting the immutable
  application container. The runtime image ships the Prisma CLI, the schema and the migration
  history precisely so this command works inside it.
- `GET /health` is registered ahead of the rate limiter, so a load balancer can poll it without
  spending the request budget of the IP it shares. It reports `503` when the database is
  unreachable.
- The included `Dockerfile` builds the API image. Supply production secrets through the platform's
  secret manager, never an image or `.env` file.
