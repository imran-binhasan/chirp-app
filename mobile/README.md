# Mini Social Feed — Mobile App (Chirp)

React Native (Expo) client for the Mini Social Feed API: auth, a shared feed with
username filtering, post creation, likes, comments, and FCM push notifications.

**Stack:** Expo SDK 57 · Expo Router · React 19 · TanStack Query 5 · axios ·
expo-secure-store · expo-notifications · FlashList

## Quick start

```bash
npm install
npx expo start -c
```

The app reads `EXPO_PUBLIC_API_URL` (defaults to the Android emulator alias
`http://10.0.2.2:4000/api/v1`). Create `mobile/.env` and point it at your
machine's LAN IP when running on a physical phone:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1
```

> Push notifications need a real build. Expo Go (SDK 53+) dropped push support,
> so use the APK or a development build for FCM. Everything else works in Expo Go.

## Building the APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # produces an installable .apk
```

The Android package name must match `com.techz.socialapp` in `app.json`, and the
app needs `google-services.json` from your Firebase project (gitignored).

## Screens

| Route                  | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `welcome`              | Landing screen for signed-out users                            |
| `(auth)/login`         | Log in with email **or** username                              |
| `(auth)/signup`        | Create an account                                              |
| `(main)/feed`          | Shared feed, infinite scroll, filter by username               |
| `(main)/create`        | Compose a chirp (2000 char limit, live counter)                |
| `(main)/inbox`         | Likes & replies on your chirps, with unread badge              |
| `(main)/profile`       | Your chirps, member-since, log out                             |
| `post/[id]`            | Single chirp with paginated replies                            |
| `user/[username]`      | Another user's chirps                                          |

## Testing

```bash
npm test              # Jest + React Native Testing Library
npm run test:coverage # with a coverage report
```

## Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm start`            | Expo dev server                      |
| `npm run android`      | Open on Android device/emulator      |
| `npm run typecheck`    | `tsc --noEmit`                       |
| `npm test`             | Jest test suite                      |
| `npm run test:coverage`| Tests with coverage report           |