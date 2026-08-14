# Mini Social Feed

A lightweight social app: users post text updates, browse a shared feed, like and
comment on posts, and receive push notifications (Firebase Cloud Messaging) when
someone interacts with their posts.

## Deliverables

- **GitHub repository:** _<add your repo URL here>_
- **APK download (Google Drive):** _<add your Drive link here>_

## Repository layout

| Folder     | Description                                                              |
| ---------- | ------------------------------------------------------------------------ |
| `backend/` | Node.js + Express 5 + TypeScript + Prisma + PostgreSQL REST API with FCM |
| `mobile/`  | React Native (Expo) app — feed, posting, interactions, push              |

## Quick start

```bash
# 1. Backend — starts PostgreSQL, applies migrations, serves on :4000
cd backend
cp .env.example .env          # fill in JWT secrets (min 32 chars each)
docker compose up -d
npm install
npm run prisma:deploy
npm run dev

# 2. Mobile — in a second terminal
cd mobile
npm install
echo 'EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1' > .env
npx expo start -c
```

Full setup, architecture and API reference:

- [`backend/README.md`](backend/README.md) — API docs, database design, security
- [`mobile/README.md`](mobile/README.md) — device setup, APK build, screen map

Interactive API docs run at **http://localhost:4000/api/docs** once the backend is up.

## Design decisions

The brief asked for a "mini" app. A few areas were built to production standards
because they are where a feed app actually breaks at scale:

- **Keyset (cursor) pagination** instead of `limit`/`offset`. Offset pagination
  skips and repeats rows when new posts arrive mid-scroll — exactly what happens
  on a live feed. Cursors seek on a composite index and stay stable.
- **Rotating refresh tokens.** Short-lived access tokens (15 min) plus refresh
  tokens that are hashed at rest and rotated on every use. Replaying a rotated
  token is treated as theft and revokes the user's entire session family.
- **Denormalized counters in-transaction.** `likeCount` / `commentCount` move in
  the same transaction as the like or comment, so feed cards read counts in O(1)
  rather than aggregating per row.
- **No N+1 on the feed.** `likedByMe` for a whole page resolves in one batched
  query, not one query per post.

## Testing

```bash
cd backend && npm test     # 35 integration tests against a real PostgreSQL
```

## Feature checklist

| Requirement                                    | Status                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| Signup / login with JWT                        | ✅ argon2id, access + rotating refresh tokens   |
| `POST /posts` — create text post               | ✅ 2000 char limit, validated                    |
| `GET /posts` — paginated, newest first         | ✅ cursor-based                                  |
| `POST /posts/:id/like` — like/unlike           | ✅ idempotent toggle, race-proof                 |
| `POST /posts/:id/comment` — add comment        | ✅ (`/comments` also accepted)                   |
| FCM push on like & comment                     | ✅ + in-app inbox, dead-token pruning            |
| Login & signup screens                         | ✅ inline validation                             |
| Feed with like + comment buttons               | ✅ optimistic likes                              |
| Filter newsfeed by username                    | ✅ search control in the feed header             |
| Create-post form                               | ✅ live character counter                        |
| Push notifications received in-app             | ✅ tap deep-links to the post                    |
| API docs in README                             | ✅ + generated OpenAPI at `/api/docs`            |
| Tablet & phone support                         | ✅ responsive layout, orientation unlocked       |
| Error handling & validation                    | ✅ zod on every input, uniform error envelope    |
