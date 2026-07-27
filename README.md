# Monzy

A social network for mothers on maternity leave — nearby meetups, activities,
chats, and local communities. iOS-first, React Native + Expo + TypeScript +
Supabase.

## Status

First vertical slice is wired end-to-end against real Supabase data:
Register or sign in → Discover nearby activities → view an activity → join it
→ create your own → share it. Basic Profile screen with sign-out and
notification preference toggles.

- Auth: email/password (full registration: name, email, password, phone,
  optional photo, baby name + age, ToS acceptance) and Sign in with Apple.
  Sessions persist automatically; existing session skips straight to the app.
- Discover, Activity Detail, Create Activity (map + address search +
  draggable pin, duration/baby-age-range pickers), join/leave, and a
  WhatsApp/native share flow with `momzi://activity/:id` deep links are all
  live.

Not yet built: Chat, Communities, full Settings, edit-profile, report flow,
onboarding polish (splash/loading state), Android.

Deferred on purpose: the push notification **send** pipeline (DB triggers →
Edge Function → Expo push API) — token registration and preference storage
are in place, but nothing sends yet.

External setup still needed before a real device build:
- Apple Developer "Sign in with Apple" capability + Supabase's Apple OAuth
  provider (Services ID / Team ID / Key) — client code is ready, this is
  dashboard-only config.
- APNs credentials for production push delivery.
- App icon / splash assets (none exist yet).

## Setup

```bash
npm install
npx expo start --ios
```

Requires Xcode + iOS Simulator (or a physical device with Expo Go for
non-native-module testing — note `react-native-maps` requires a development
build, not Expo Go, once you're testing on device).

## Project structure

```
src/
  theme/       Design tokens — colors, typography, spacing, motion. Import from '@/theme'.
  types/       Shared domain types (Activity, ActivityDetail, Profile, etc.)
  components/  Reusable UI (forms, pickers, ActivityCard, ActivityMapPin, ...)
  screens/     Full screens, incl. screens/auth/ (Welcome, SignIn, SignUp, ...)
  navigation/  AuthNavigator (pre-session stack)
  hooks/       Data hooks — useAuth, useNearbyActivities, useActivityDetail,
               useActivityRsvp, useCreateActivity, usePushNotifications
  lib/         Supabase client, avatar upload
docs/
  imagery-guidelines.md   Illustration vs photography decision and rationale
```

## Supabase

Project ref: `ghzpzimcxvccbmjsttlf` (region: ap-northeast-2). Schema and RLS
policies are applied via migrations (see migration history in the Supabase
dashboard) — profiles, activities, activity_attendees, chats, connections,
notifications, reports, blocks, push_tokens, plus a `public_profiles` view
for the safe/public subset of profile fields and an `avatars` storage bucket.
Key functions: `nearby_activities()`, `get_or_create_direct_chat()`.

## Design system decisions

- Typeface: Plus Jakarta Sans (not Inter — deliberately avoiding the current
  default "AI-generated product" look)
- Icons: Phosphor, regular weight
- Palette: sage / sand / sky ("fresh & airy")
- Imagery: custom illustration for app-owned surfaces, real photos only for
  user-uploaded content — see `docs/imagery-guidelines.md`
