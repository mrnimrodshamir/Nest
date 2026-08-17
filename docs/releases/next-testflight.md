# NestUp — Tel Aviv MVP physical-validation build

CURRENT VERSION: `0.1.0`

BUILD: `40`

RELEASE SHA: `425e40791a33ab0dec1afe0ce6baf8b737bead8f`

EAS BUILD ID: `1c077c66-79ca-480e-b723-06d79ea341b0`

PREVIOUS TESTFLIGHT BUILD: `39` (SHA `1b54bb5`)

DATE: `2026-08-17`

The release SHA is `origin/main`: the approved mobile SHA `67026e9` plus
website-only commits. `src/`, `App.tsx`, `app.json`, `package.json` and
`eas.json` are byte-identical between `67026e9` and this SHA, so the mobile
binary is exactly the approved code.

## The map fix is NOT proven

Status of the Discovery map lifecycle fix is exactly:

- **Root cause proven**
- **Fix implemented**
- **Needs device validation**

A green build proves nothing about it. Only physically panning the map on an
iPhone after returning from a detail screen can close this. Do not mark it
resolved on the strength of tests or a successful build.

## What changed since Build 39

- Discovery deterministically remounts the MapView after returning from
  Event, Activity and Place, and after app foregrounding. The old delayed
  700 ms MapKit teardown is gone.
- Apple-authenticated users with incomplete or legacy profiles are routed
  through profile completion. Apple Private Relay remains supported.
- Hebrew MVP localization: Discovery filters, activity creation, child age
  presentation, place taxonomy, canonical Hebrew Tel Aviv place names.
- Regression tests aligned to the new map lifecycle.

## P0 — must pass

The build exists to answer these. Anything failing here blocks the MVP.

- [ ] 1. Discovery → Event → Back → immediately pan the map.
- [ ] 2. Repeat with at least 10 different Events.
- [ ] 3. Pan and zoom between opens.
- [ ] 4. Activity → Back → map still works.
- [ ] 5. Place → Back → map still works.
- [ ] 6. Background the app → foreground → map works.
- [ ] 7. No crash opening any Event.
- [ ] 8. WhatsApp share does not crash.
- [ ] 9. Native share does not crash.

## MVP validation

- [ ] 10. Apple login with an incomplete/legacy profile reaches profile completion.
- [ ] 11. "Momzy Member" never renders as a real identity.
- [ ] 12. Hebrew Discovery filters.
- [ ] 13. Hebrew activity creation.
- [ ] 14. Hebrew child ages.
- [ ] 15. Hebrew canonical Tel Aviv place names.
- [ ] 16. RSVP / Who's Going.
- [ ] 17. Chats.
- [ ] 18. Forums.
- [ ] 19. Profile.
- [ ] 20. Language switching across EN / HE / FR / RU.

## Validation run on the exact release SHA

| Gate | Result |
|---|---|
| Full suite | 951 / 951 passed |
| Map & Discovery lifecycle | 88 passed |
| Apple onboarding & profile completeness | 24 passed |
| Hebrew & RTL | 132 passed |
| Sharing | 53 passed |
| `tsc --noEmit` | clean |
| `expo-doctor` | 21 / 21 |
| `expo export --platform ios` | success |
| `git diff --check` | clean |
| Credential scan | clean |

## Work deliberately excluded from this build

Two batches of post-approval mobile work exist and are **not** in this
binary. Both are preserved on `origin/codex/i18n-rtl-wip`:

- `ada6e21` — `feat(i18n): centralize localized generated copy`
- `f9b0712` — RTL logical-property pass across 20 screens, **incomplete**;
  this was the uncommitted working tree when Codex credits ran out

Neither was in the approved commit set, neither has been validated against
the 951-test baseline, and the second is unfinished. They are candidates for
the build after this one, once validated.
