# Mini Social Feed — Backend API

REST API for the Mini Social Feed app: JWT auth, text posts, likes & comments
with FCM push notifications on new interactions.

**Stack:** Node.js 20+ · Express 5 · TypeScript · Prisma 6 · PostgreSQL 16 ·
Zod · pino · Vitest/Supertest · firebase-admin

## Getting started

1. Copy the env file and fill in the JWT secrets (min 32 chars each):

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL (and the isolated test DB):

   ```bash
   docker compose up -d
   ```

3. Install, migrate and run:

   ```bash
   npm install
   npm run prisma:deploy
   npm run dev        # http://localhost:4000
   ```

Verify with `curl http://localhost:4000/health`. Swagger UI is served at
`http://localhost:4000/api/docs` (raw spec at `/api/docs.json`).

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

## API

Base path: `/api/v1`. Authenticated endpoints require
`Authorization: Bearer <accessToken>`.

| Method | Path                  | Auth | Description                                  |
| ------ | --------------------- | ---- | -------------------------------------------- |
| POST   | `/auth/signup`        | —    | Create account (username, email, password)    |
| POST   | `/auth/login`         | —    | Log in with email **or** username            |
| POST   | `/auth/refresh`       | —    | Rotate token pair (reuse → revoke all)       |
| POST   | `/auth/logout`        | —    | Revoke a refresh token (idempotent)          |
| GET    | `/auth/me`            | ✔    | Current user                                 |
| POST   | `/posts`              | ✔    | Create post (max 2000 chars)                 |
| GET    | `/posts`              | ✔    | Feed, newest-first, `?limit&cursor&username` |
| GET    | `/posts/:id`          | ✔    | Single post (+ `likedByMe`)                  |
| POST   | `/posts/:id/like`     | ✔    | Toggle like → `{ liked, likeCount }`         |
| POST   | `/posts/:id/comments` | ✔    | Add comment (max 1000 chars)                 |
| GET    | `/posts/:id/comments` | ✔    | Comments, newest-first, `?limit&cursor`      |
| GET    | `/notifications`      | ✔    | Your inbox, newest-first, `?limit&cursor`    |
| GET    | `/notifications/unread-count` | ✔ | Unread total for the tab badge            |
| POST   | `/notifications/read` | ✔    | Mark all as read (idempotent)                |
| POST   | `/devices`            | ✔    | Register an FCM device token                 |
| DELETE | `/devices/:token`     | ✔    | Unregister a device token on logout          |
| GET    | `/health`             | —    | Liveness + DB check                          |

Every endpoint uses a uniform envelope:

```jsonc
{ "success": true, "data": { }, "error": null,
  "meta": { "requestId": "...", "timestamp": "..." } }
```

## Push notifications (FCM)

Likes and comments on someone else's post trigger a push to all of the author's
registered devices. Add the Firebase service-account fields to `.env`
(`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — the
API runs fine without them and simply skips pushes.

## Testing

```bash
npm test
```

35 integration tests against a real PostgreSQL (Vitest + Supertest) covering
auth flows, post creation, cursor pagination, like toggling, comments and
notification fan-out.