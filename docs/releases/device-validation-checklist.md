# NestUp next-build device validation

## Installation and authentication

- [ ] Clean install; confirm launch, version/build line, and onboarding start.
- [ ] Upgrade from Build 31; confirm session and profile remain intact.
- [ ] Apple Sign-In, new user; complete the unified profile and reach Discovery.
- [ ] Apple Sign-In, returning user; route directly to Discovery.
- [ ] Email login and email onboarding both complete without duplicate profiles.

## Language and layout

- [ ] English.
- [ ] Hebrew with RTL after relaunch.
- [ ] French.
- [ ] Russian/Cyrillic remains LTR.
- [ ] User-written text follows its own script in every locale.
- [ ] Small iPhone and standard iPhone layouts.

## Sharing

- [ ] Activity, Place, and Event native share.
- [ ] WhatsApp installed.
- [ ] WhatsApp absent: native fallback appears.
- [ ] Cancel native share; app remains responsive.
- [ ] Double-tap native and WhatsApp share; only one presentation opens.
- [ ] Shared copy has one readable NestUp link and no internal/debug text.

## Discovery and content

- [ ] Search, compact Filters, multi-select content types, and list-only Sort.
- [ ] Map camera and markers remain stable while filters/sort change.
- [ ] Activity cards and details have bounded images and working actions.
- [ ] Place cards/details have bounded images, fallback art, and working actions.
- [ ] Event cards/details have bounded images, lifecycle, and working actions.

## Event Attendance and community

- [ ] RSVP on, reopen Event, RSVP persists.
- [ ] RSVP off, reopen Event, RSVP is removed.
- [ ] Who’s going count, avatars, attendee list, and Public Profile navigation.
- [ ] External registration remains clearly separate from NestUp RSVP.
- [ ] Chats and Forums open; a forum message sends and persists.

## Family profile and onboarding regression

- [ ] Profile edit persists after navigation and relaunch.
- [ ] Parent date of birth produces derived public age only.
- [ ] Exact parent/child birthdates and contact details stay private.
- [ ] Child/family context renders correctly on Public Profile.
- [ ] Denied permissions, offline/weak network, and retry states do not crash.

## Analytics release verification

- [ ] Complete one identifiable sequence: launch -> login -> Discovery -> open
  one Activity, Place, and Event -> join/RSVP -> share -> send one chat/forum
  message.
- [ ] Perform one successful native share, one successful WhatsApp share, and
  one cancelled native share.
- [ ] Switch language once, then continue navigating in the new language.
- [ ] After the session, verify Supabase contains the expected event names,
  one shared `session_id`, the resolved `language`, authenticated `user_id`, and
  server timestamps; verify no private text or duplicate render events.

## Ten-minute iPhone smoke test

1. **0:00-1:00 — Install/launch:** open the build, note the in-app version/build,
   log in, and confirm the existing profile/session survives an upgrade.
2. **1:00-2:30 — Languages/onboarding:** switch EN -> HE (confirm RTL), then HE
   -> FR or RU; open profile editing and confirm role, derived age, children,
   and optional family details without exact birthdates.
3. **2:30-4:00 — Discovery:** use Search, open compact Filters, select at least
   two content types, change Sort, and confirm map camera/markers stay stable.
4. **4:00-5:30 — Content:** open one Activity, Place, and Event; verify bounded
   images, readable details, navigation, and back behavior on the real screen.
5. **5:30-7:00 — Attendance:** join then leave an Activity; mark an Event “I’m
   going,” open Who’s Going and a Public Profile, then remove the RSVP. Confirm
   external registration remains separate.
6. **7:00-8:30 — Sharing:** native-share one content item, cancel a second share,
   and share one through WhatsApp. Confirm one readable NestUp link and no crash.
7. **8:30-9:30 — Community:** open Chats and a Forum, send one short message,
   leave and return, and confirm it persists with correct keyboard direction.
8. **9:30-10:00 — Resilience:** briefly disable network, revisit Discovery or a
   detail screen, confirm a safe error/empty state, restore network, and retry.

Stop and report the exact screen and action for any crash, frozen spinner,
misrouting, duplicate action, privacy leak, or layout obstruction.
