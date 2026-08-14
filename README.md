# Mini Social Feed (Chirp)

A lightweight social app for posting text updates, browsing a shared feed, interacting via likes/comments, and receiving push notifications (Firebase Cloud Messaging).

**Repository:** [https://github.com/imran-binhasan/chirp-app](https://github.com/imran-binhasan/chirp-app)

## ✅ Requirements Fulfillment

**Backend** — Node.js · Express 5 · TypeScript · Prisma · PostgreSQL

| Requirement | Delivered |
| --- | --- |
| Authentication: signup/login using JWT | `POST /auth/signup`, `POST /auth/login` — argon2id hashes, 15-minute access tokens, rotating refresh tokens |
| `POST /posts` — create a text-only post | ✔ validated, max 2000 characters |
| `GET /posts` — all posts, paginated, newest first | ✔ cursor-paginated, plus a `?username=` feed filter |
| `POST /posts/:id/like` — like or unlike | ✔ one endpoint toggles, or send `{ liked }` explicitly |
| `POST /posts/:id/comment` — add a comment | ✔ (`/comments` works too) |
| FCM notifications on like/comment | ✔ push to the post's author, plus an in-app inbox |
| API docs in the README | ✔ [`backend/README.md`](backend/README.md#-api-documentation), plus generated OpenAPI at `/api/docs` |

**Mobile App** — React Native · Expo · Expo Router · TanStack Query

| Requirement | Delivered |
| --- | --- |
| Login & Signup screens | ✔ with client-side validation mirroring the server's rules |
| Feed: scrollable posts with like + comment buttons | ✔ FlashList, optimistic likes, infinite scroll |
| Filter the feed by username | ✔ debounced search in the feed header |
| Create Post: text-only form | ✔ with a live character counter |
| Firebase push notifications for likes and comments | ✔ `expo-notifications` + FCM, tapping a push opens the post |
| *Extra points:* UI polish and responsiveness on tablet and phone | ✔ side navigation rail and a capped reading column on tablets, automatic dark mode |
| *Extra points:* error handling and validation | ✔ one normalized error type, field-level form errors, retryable error states, a render-crash boundary |

## 📂 Project Structure
The repository is divided into two main isolated environments:

```text
.
├── backend/    # Node.js REST API (Express 5, TypeScript, Prisma, PostgreSQL)
└── mobile/     # React Native App (Expo, TanStack Query, FlashList)
```

## 🚀 Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env          # fill in JWT secrets
docker compose up -d
npm install
npm run prisma:deploy
npm run prisma:seed           # optional demo data — log in as "demo" / Password123!
npm run dev
```

### 2. Mobile
```bash
cd mobile
npm install
echo 'EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1' > .env
npx expo start -c
```
*(See `backend/README.md` and `mobile/README.md` for specific architectural details and testing instructions.)*



## 🌟 Beyond the Requirements (Not Scope Creep)
I built a few areas beyond the requested scope because they are critical for a feed app at production scale. These are necessary UX and performance implementations:

- **Keyset (cursor) pagination** instead of `limit`/`offset`. Offset pagination skips and repeats rows when new posts arrive mid-scroll. Cursors seek on a composite index and stay stable.
- **Rotating refresh tokens.** Short-lived access tokens (15 min) plus refresh tokens that are hashed at rest and rotated on every use. Replaying a rotated token revokes the user's entire session family (theft detection).
- **Denormalized counters in-transaction.** `likeCount` / `commentCount` move in the same transaction as the like or comment, allowing O(1) feed reads.
- **No N+1 on the feed.** `likedByMe` for a whole page resolves in one batched query, rather than one query per post.
- **In-App Notification Table.** Added an in-app inbox tab. Relying solely on push notifications is poor UX when a user dismisses a push; they need a central place to see interactions.
- **Offline-First Feed Caching.** Implemented `@tanstack/react-query-persist-client` with AsyncStorage so the feed loads instantly on a cold boot without network.
