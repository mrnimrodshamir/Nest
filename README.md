# Momzi

A social network for mothers on maternity leave — nearby meetups, activities,
chats, and local communities. iOS-first, React Native + Expo + TypeScript +
Supabase.

## Status

Early build. Discover (map + draggable sheet) and Activity Detail screens are
implemented against mock data. Supabase schema is live (see `docs/`), but the
app isn't wired to it yet — see `TODO(supabase)` comments in `src/hooks/`.

Not yet built: Create/Host activity, Chat, Profile, Notifications,
Onboarding, Trust & verification.

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
  types/       Shared domain types (Activity, ActivityDetail, etc.)
  components/  Reusable UI (ActivityCard, CategoryChip, EmptyState, ActivityMapPin)
  screens/     Full screens (DiscoverScreen, ActivityDetailScreen)
  hooks/       Data hooks — currently mock-backed, shaped for a Supabase swap
docs/
  imagery-guidelines.md   Illustration vs photography decision and rationale
```

## Supabase

Project ref: `ghzpzimcxvccbmjsttlf` (region: ap-northeast-2). Schema, RLS
policies, and the `nearby_activities` / `get_or_create_direct_chat` functions
are already applied — see migration history in the Supabase dashboard.

## Design system decisions

- Typeface: Plus Jakarta Sans (not Inter — deliberately avoiding the current
  default "AI-generated product" look)
- Icons: Phosphor, regular weight
- Palette: sage / sand / sky ("fresh & airy")
- Imagery: custom illustration for app-owned surfaces, real photos only for
  user-uploaded content — see `docs/imagery-guidelines.md`
