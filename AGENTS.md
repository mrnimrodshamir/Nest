# NestUp Mobile App — Codex Instructions

## Product

Expo / React Native parenting-community application.

Bundle identifier:
`com.nest.mobile`

The app is inclusive of:

- mothers
- fathers
- same-sex parents
- single parents
- adoptive parents
- co-parents
- caregivers
- diverse family structures

Use neutral parent/caregiver language.

## Current beta baseline

Build 23 is the current validated beta baseline.

Do not break:

- authentication
- onboarding
- activity creation
- activity editing
- map discovery
- My Activities
- activity chats
- push notifications
- child selection
- Coming alone
- activity artwork
- TestFlight configuration

## Git safety

Before every implementation task:

1. Run `git status`.
2. Record the current branch and HEAD.
3. Preserve existing uncommitted work.
4. Do not use destructive Git commands.
5. Do not reset or force-push.
6. Do not modify unrelated files.
7. Use small reviewable commits.
8. Report each commit hash.

## Production safety

- Do not modify production data without explicit approval.
- Do not apply SQL without explicit approval.
- Do not run load tests against production.
- Do not expose or commit secrets.
- Do not print `.env` contents.
- Do not modify `public.spatial_ref_sys`.
- Do not build or upload TestFlight without approval.

## Quality requirements

After implementation, run:

- `npx tsc --noEmit`
- full automated test suite
- `npx expo-doctor`
- `npx expo export --platform ios`

Report exact results.

## Approved current scope

Phase 1a:

1. Remove exact child birthdates from attendance responses.
2. Add Participants to Activity Details.
3. Integrate lifecycle statuses.
4. Add Create Again.
5. Improve public profiles.

Do not begin system messages, attendance RLS hardening, location privacy, map optimization, Places, external events, load testing, or admin tooling without approval.
