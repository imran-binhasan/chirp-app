# Mini Social Feed — Mobile App (Chirp)

React Native (Expo) client for the Mini Social Feed API: auth, a shared feed with
username filtering, post creation, likes, comments, and FCM push notifications.

**Stack:** Expo SDK 57 · Expo Router · React 19 · TanStack Query 5 · axios ·
expo-secure-store · expo-notifications · FlashList

---

## Quick start

### 1. Install

```bash
cd mobile
npm install
```

### 2. Point the app at your backend

The app reads `EXPO_PUBLIC_API_URL`. Create `mobile/.env`:

```bash
# Android emulator (10.0.2.2 is the emulator's alias for your host machine)
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1

# Physical device — use your machine's LAN IP, NOT localhost
# EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1
```

If unset it defaults to the emulator address, which will **not** reach your
machine from a physical phone. Find your LAN IP with `ip addr` (Linux) or
`ipconfig getifaddr en0` (macOS), and make sure the backend is running.

### 3. Run

```bash
npx expo start -c
```

> **Push notifications need a real build.** Expo Go (SDK 53+) removed push
> support, so `expo-notifications` cannot fetch an FCM token there. Everything
> else — auth, feed, posting, likes, comments, the in-app inbox — works in Expo
> Go. For push, use the APK or a development build (below).

### 4. Firebase (push only)

Push requires `mobile/google-services.json` from your Firebase project
(Project settings → Your apps → Android). It is **gitignored** — download your
own; the Android package name must match `com.techz.socialapp` in `app.json`.

The backend needs the matching service-account credentials — see
[`../backend/README.md`](../backend/README.md#push-notifications-fcm).

## Building the APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # produces an installable .apk
```

`preview` builds an APK; the default `production` profile builds an AAB for Play
Store upload. Configure profiles in `eas.json`.

## Screens

| Route                  | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `welcome`              | Landing screen for signed-out users                            |
| `(auth)/login`         | Log in with email **or** username                              |
| `(auth)/signup`        | Create an account                                              |
| `(main)/feed`          | Shared feed, infinite scroll, **filter by username**           |
| `(main)/create`        | Compose a chirp (2000 char limit, live counter)                |
| `(main)/inbox`         | Likes & replies on your chirps, with unread badge              |
| `(main)/profile`       | Your chirps, member-since, log out                             |
| `post/[id]`            | Single chirp with paginated replies                            |
| `user/[username]`      | Another user's chirps                                          |

## Architecture

```
src/
├── api/
│   ├── client.ts         # axios instance, bearer injection, single-flight 401
│   │                     #   refresh, envelope unwrapping, typed get/post/getPage
│   ├── endpoints.ts      # every API route, typed end to end — no URL literals
│   │                     #   in screens
│   ├── errors.ts         # ApiError + toApiError: one error type for the app
│   └── queryKeys.ts      # every react-query cache key in one place
├── app/                  # Expo Router file-based routes
│   ├── (auth)/           #   public group
│   ├── (main)/           #   tab group, redirects out when signed out
│   ├── post/[id].tsx
│   └── user/[username].tsx
├── components/           # PostCard, LikeButton, UserAvatar, ParsedText,
│                         #   ScreenContainer, ErrorBoundary, StateViews,
│                         #   FormField, AuthScreen
├── hooks/                # useLikeMutation (optimistic), usePostList,
│                         #   usePushNotifications, useDebouncedValue
├── store/AuthContext.tsx # session state, login/logout, expiry handling
├── types/api.ts          # wire types mirroring the backend DTOs
└── utils/                # theme, responsive, tokenStorage, authEvents, timeAgo
```

### Notable decisions

- **One error type.** Everything the API layer throws is normalised into
  `ApiError` — a code, an HTTP status, per-field messages and a user-safe
  `message`. Screens never inspect status codes or response bodies. Server-written
  4xx text ("Username is already taken") is shown verbatim; 5xx text is replaced,
  since it may leak internals and means nothing to a person.
- **Typed end to end.** `types/api.ts` mirrors the backend DTOs, `endpoints.ts`
  wraps every route, and there is no `any` in `src/`.
- **Tokens live in `expo-secure-store`** (iOS Keychain / Android Keystore), never
  in AsyncStorage. `utils/tokenStorage.ts` is the only module that names the keys.
- **Single-flight refresh.** When several requests 401 at once, exactly one
  rotation runs and the rest await it. Parallel rotations would trip the server's
  refresh-token reuse detection and revoke the whole session.
- **Optimistic likes.** `useLikeMutation` updates the cache immediately and rolls
  back on error, so the heart never lags behind the tap. Shared by all four
  screens that render posts.
- **Cursor pagination everywhere.** Feed, replies and inbox all use
  `useInfiniteQuery` driven by the API's `meta.pagination.nextCursor`.
- **Responsive.** `useResponsive` caps content at a readable measure on tablets
  and scales gutters and avatars; orientation is unlocked.
- **Theme follows the OS.** `userInterfaceStyle: "automatic"` with a full dark
  palette in `utils/theme.ts`.

- **Render crashes are contained.** An `ErrorBoundary` wraps the whole tree, so
  an unexpected throw shows a recovery screen instead of a blank device.

## Testing

```bash
npm test              # 84 tests across 12 suites
npm run test:coverage # with a coverage report
```

Jest + React Native Testing Library. The suite concentrates on the logic that
breaks silently rather than on snapshot churn:

| Area                        | What it pins down                                                |
| --------------------------- | ---------------------------------------------------------------- |
| `api/client`                | Token refresh reads `data.tokens.accessToken`; one rotation for concurrent 401s; no refresh loop; tokens cleared on failure |
| `api/errors`                | 4xx messages surface, 5xx messages are suppressed, field errors stay addressable |
| `store/AuthContext`         | Session restore, logout revokes server-side, involuntary expiry clears state |
| `hooks/useLikeMutation`     | Optimistic increment/decrement, rollback on failure, no cross-post bleed |
| `app/(main)/feed`           | Username filtering, debounce, empty and error states              |
| `app/(auth)/login`          | Validation gating, success routing, server error banner           |
| `components/*`              | PostCard rendering and accessibility labels, ParsedText linkifying, ErrorBoundary recovery |

Core logic (`client`, `errors`, `AuthContext`, `useLikeMutation`, `tokenStorage`,
`PostCard`, `StateViews`, `login`, `feed`) sits at 93–100% coverage.

## Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm start`            | Expo dev server                      |
| `npm run android`      | Open on Android device/emulator      |
| `npm run typecheck`    | `tsc --noEmit`                       |
| `npm test`             | Jest test suite                      |
| `npm run test:coverage`| Tests with coverage report           |
