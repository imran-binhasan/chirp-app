# Mini Social Feed — Mobile App (Chirp)

React Native (Expo) client for the Mini Social Feed API. Features a shared feed, post creation, likes, comments, and FCM push notifications.

**Repository:** [https://github.com/imran-binhasan/chirp-app](https://github.com/imran-binhasan/chirp-app)

## Tech Stack
Expo SDK 57 • React Native • Expo Router • TanStack Query 5 (with Offline Caching) • FlashList • React Hook Form

## ✅ Completed Requirements
- [x] Login & Signup screens with client-side validation mirroring the backend.
- [x] Feed with scrollable posts, like/comment buttons, and username filtering.
- [x] Create Post text-only form with a character counter.
- [x] Push notifications integrated via `expo-notifications` and Firebase.
- [x] UI polish: Fully responsive on tablets (side-rail nav) and mobile, with automatic dark mode support.
- [x] Offline-first feed persistence added for immediate cold-boot rendering.

## 📂 Folder Structure
```text
src/
├── api/             # Axios client, refresh token interceptors, query keys, error normalization
├── app/             # Expo Router file-based navigation (auth vs main groups)
├── components/      # Reusable UI (PostCard, FormField, ErrorBoundary)
├── hooks/           # Custom logic (useLikeMutation, usePostList, usePushNotifications)
├── store/           # AuthContext (React Context for session state)
│                    #   api/queryClient.ts owns the cache + its disk persister,
│                    #   so sign-out can drop both
├── types/           # Strict TypeScript interfaces mirroring backend DTOs
└── utils/           # Theme, responsive layout calculations, secure token storage
```

## 🚀 Quick Start

### 1. Install & Configure
```bash
npm install
```
Create `mobile/.env` and point it to your backend:
```bash
# Android emulator (10.0.2.2 points to host machine)
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1

# Physical device (Use your LAN IP)
# EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1
```

### 2. Run the App
```bash
npx expo start -c
```
*(Note: Push notifications require a real build. Auth, feed, offline caching, and posting work natively in Expo Go.)*

### 3. Push Notifications Setup
Place your `google-services.json` from Firebase in the `mobile/` directory. Ensure the Android package name matches `com.techz.socialapp` in `app.json`.

## 📦 Building the APK

> **Set the API URL first.** `.env` is a local-development file — it is *not* uploaded to EAS.
> A build reads `EXPO_PUBLIC_API_URL` from the profile's `env` block in `eas.json`, and with
> nothing set it falls back to `http://10.0.2.2:4000/api/v1`, which is the Android *emulator's*
> alias for your laptop and means nothing on a real phone.

1. **Point `eas.json` at your deployed backend.** Replace the placeholder in the `preview`
   (and `production`) profile:
   ```json
   "env": { "EXPO_PUBLIC_API_URL": "https://your-api-host/api/v1" }
   ```

2. **Build:**
   ```bash
   npm install -g eas-cli
   eas login
   eas build --platform android --profile preview
   ```

The `preview` profile produces an installable APK. Before sharing it, install it on a physical
Android phone and verify signup, login, feed pagination, tablet navigation, and an FCM
like/comment notification end to end.

### Why `.easignore` exists
`google-services.json` is gitignored, but `app.json` points `android.googleServicesFile` at it —
and EAS honours ignore rules when uploading your project. Without `.easignore` re-including that
file, the build fails while configuring Firebase. Keep the two files in step if you edit either.

### If your backend is plain HTTP
Android blocks cleartext traffic in release builds; only the debug variant permits it. An APK
pointed at an `http://` host will fail every request. Prefer HTTPS. If you genuinely need
cleartext for a LAN-hosted demo, install `expo-build-properties` and add to `app.json`:
```json
["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
```

## 🧪 Testing
Jest covers the logic worth protecting: token-refresh concurrency, optimistic like mutations and
their cross-cache propagation, the auth gate on deep-linked screens, error normalization, and
form validation.
```bash
npm test              # Run Jest test suite
npm run test:coverage # Generate coverage report
```
