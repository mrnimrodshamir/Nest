# NestUp — next TestFlight validation build

CURRENT VERSION: `0.1.0`

CURRENT LAST TESTFLIGHT BUILD: `31`

EXPECTED NEXT BUILD: `32` (EAS remote auto-increment; not created)

LAST TESTFLIGHT SHA: `e74cdd081872c1dff0113b8f206a92c97130e46c`

CODE AUDIT BASELINE SHA: `6ef4ccfaa435c4901ddce48a41df8f76c9ffa143`
DATE: `2026-08-14`

The final Git SHA is the clean `origin/main` SHA approved immediately before
building. This document is intentionally not an EAS build authorization.

## What's new

- Sharing reliability hardened across Activities, Places, and Events, including
  WhatsApp fallback, cancellation, double taps, and malformed links.
- French and Russian added alongside English and Hebrew, with improved text
  direction for user-written Hebrew and Cyrillic content.
- Rich Family Profiles with caregiver context and privacy-safe public details.
- One consistent family-profile onboarding flow for email and Apple sign-in.
- Event Attendance: mark “I’m going,” see who else is going, and open existing
  public profiles without confusing NestUp RSVP with provider registration.
- DigiTel event ingestion now runs automatically with lifecycle-safe retention,
  stable identity, and provider-presence reconciliation.
- Expo SDK 57 dependency patches aligned for release validation.
- Privacy-safe Supabase funnel analytics across launch, onboarding/login,
  Discovery, content opens, Activity/Event attendance, sharing, Chats, Forums,
  and profiles. Events include per-launch session attribution and resolved app
  language, while share completion/cancellation/failure and WhatsApp/native
  channels remain distinct.

Discovery controls, card/image sizing, Forums, and the NestUp logo were already
present in Build 31. They remain high-priority regression checks but are not
presented as new in this build.

## What to test

1. Open Discovery, use Search, select multiple content types in Filters, change
   Sort, switch between map/list positions, and confirm the camera stays put.
2. Share one Activity, Place, and Event through native share and WhatsApp.
   Cancel a sheet, double-tap a share button, and confirm the app never crashes.
3. With WhatsApp unavailable, tap WhatsApp share and confirm the native share
   sheet opens with one readable NestUp deep link.
4. Switch between English, Hebrew, French, and Russian. Relaunch when prompted;
   verify Hebrew RTL and that user-written text follows its own script.
5. Open an Event, tap “I’m going,” leave and reopen it, and confirm the RSVP
   persists. Open “Who’s going” and an attendee’s existing Public Profile.
6. If the Event has external registration, confirm it remains a separate action
   from the NestUp RSVP.
7. Open and edit a Family Profile. Relaunch and verify role, derived age,
   children, neighbourhood, occupation, and bio persist without exposing exact
   birthdates publicly.
8. Complete a clean email onboarding and a clean Apple onboarding. Confirm both
   reach the same complete profile and route to Discovery afterward.
9. Open Chats, enter a Forum, send a message, leave and return, and confirm it
   persists with correct keyboard and text-direction behaviour.
10. On a small iPhone, inspect Activity, Place, and Event cards/details; images
    must stay bounded with no clipped controls or oversized empty media.

## Exact release reconciliation

Actual comparison: `e74cdd081872c1dff0113b8f206a92c97130e46c..origin/main`.

- User-visible: EN/HE/FR/RU language support; rich family profiles; unified
  onboarding; Event Attendance / Who’s going; script-aware user text; release
  sharing hardening and graceful fallback.
- Backend-only: active occurrence lifecycle view; shared DigiTel connector and
  sync decision layer; automated provider sync; source-presence/relevance
  separation and retention safeguards.
- Website-only: landing-page design/assets and Vercel local-file hygiene.
- Tests/tooling: sharing regression matrix, analytics privacy/transport tests,
  DigiTel lifecycle tests, film prompt/production documents.
- Dependencies: nine Expo SDK 57 patch versions aligned to Expo recommendations.

## Build 31 comparison: definitive product classification

### New in the next build

- French and Russian, completing EN/HE/FR/RU; Hebrew remains RTL and Cyrillic
  user content remains LTR.
- Rich Family Profiles, including caregiver role, derived parent age, family
  context, neighbourhood, occupation, and bio with exact birthdates private.
- Unified family-profile onboarding for email and Apple Sign-In, plus centralized
  completeness/routing for interrupted onboarding.
- Social Event Attendance: “I’m going,” removal, attendee count/avatars,
  Who’s Going, and existing Public Profile navigation; provider registration
  remains separate.
- Lifecycle-safe automated DigiTel synchronization with provider presence kept
  separate from NestUp publication relevance and history/RSVP retention.
- Hardened Activity/Place/Event sharing and privacy-safe funnel analytics.
- Expo SDK 57 compatible patch alignment.

### Present in Build 31 and regression-tested, not new

- Compact Discovery Search / Filters / Sort controls and multi-select content
  filters.
- Bounded Activity/Place/Event image and card sizing.
- Forums and forum chat.
- Activity attendance/participants and Activity chat.
- Existing Activity/Place/Event sharing surfaces and deep links (the runtime
  reliability and analytics around them are new).
- NestUp icon, splash/logo, and branding.
- In-app `Version 0.1.0 · Build <native build>` display.

### Non-app changes since Build 31

- Website work and commercial-film production files are outside the mobile
  binary. They are not part of this release’s device feature claims.
