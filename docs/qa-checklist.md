# Momzi — first iOS build QA checklist

Grows as features land. Run this against the first real device / TestFlight build.

## Build status

- EAS iOS credentials complete: Distribution Certificate, Provisioning Profile,
  registered iPhone, Apple Push Key (assigned to `com.nest.mobile`). Set up
  interactively once — future builds reuse these automatically, no further
  Apple login needed unless credentials are revoked/expire.
- First `preview` (internal distribution) build triggered and uploaded to EAS:
  https://expo.dev/accounts/nimrodsh/projects/nest/builds/40b8c44c-80c4-4d89-ad46-b34449f10758
  (build #2, commit 2443eb7). Installs directly on the registered iPhone
  (UDID 00008150-0010193E1E88C01C) once finished — no TestFlight needed for
  this one.
- EAS project: `@nimrodsh/nest` (slug intentionally kept as the pre-rename
  name — see commit history; display name and everything user-facing is
  "Momzi").

## Sign in with Apple

- [ ] First-time sign-in (new Apple ID never used with Momzi) creates a profile via the completion form
- [ ] Returning sign-in (same Apple ID, existing profile) skips straight to the main app
- [ ] Hidden/relay Apple email (user chose "Hide My Email") — account still creates correctly, relay address stored
- [ ] Apple-provided full name is captured and saved on first auth (not requested again on return)
- [ ] Cancelled sign-in (user dismisses the native sheet) returns cleanly to Welcome, no error shown
- [ ] Session persists after force-quitting and reopening the app
- [ ] After Apple sign-in with an incomplete profile, app routes to Profile Completion, not Discover
- [ ] After Apple sign-in with a complete profile, app routes straight to Discover
- [ ] Logout, then sign in again with Apple — no duplicate profile row created
- [ ] Existing email/password account with the same email, then "Continue with Apple" — friendly conflict message, not a raw error

## Push notifications (Apple Push Key now configured)

- [ ] Permission prompt only appears after joining a first activity, or enabling reminders in settings — never on launch/onboarding
- [ ] Branded explainer sheet shows before the native permission dialog
- [ ] 24h and 2h reminders arrive before a joined activity's start time
- [ ] Host changes activity time/location — attendees get a push; host cancels — attendees get a push
- [ ] Someone joins your activity — host gets a push; activity reaching capacity — host gets a push
- [ ] New group chat message — other participants get a push (not the sender)
- [ ] New direct message — push has correct sender name and opens the right conversation on tap
- [ ] No push banner while that exact conversation is already open on screen
- [ ] Tapping a notification deep-links to the right activity/chat, cold start and warm/background
- [ ] Turning off a category in Profile → Notifications actually stops those pushes
- [ ] Sign out on one device doesn't stop push on another device still signed in

## Calendar

- [ ] "Add to Apple Calendar" creates a real event with correct title/time/location
- [ ] "Add to Google Calendar" opens the correct pre-filled event in browser/app
- [ ] Host changes activity time — banner offers to update the calendar event on next visit
- [ ] Host cancels — banner offers to remove the calendar event on next visit

## Maps

- [ ] Apple Maps renders (not Google Maps) on the Discover map and Activity Detail
- [ ] Custom colored pins, not default red markers
- [ ] "Directions" opens Apple Maps with the correct destination
- [ ] Draggable pin works correctly when creating/editing an activity
- [ ] App still works (fallback location, no crash) if location permission is denied
