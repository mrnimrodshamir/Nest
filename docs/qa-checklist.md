# Momzi — first iOS build QA checklist

Grows as features land. Run this against the first real device / TestFlight build.

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
