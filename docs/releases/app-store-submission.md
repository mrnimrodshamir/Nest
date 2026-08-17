# NestUp — App Store submission package

Prepared for the Tel Aviv MVP release candidate. **Nothing here has been
submitted to App Review.** This is the package to review and paste into App
Store Connect when the physical validation below comes back clean.

| | |
|---|---|
| App | NestUp |
| Bundle ID | `com.nest.mobile` |
| App Store Connect app ID | `6795089643` |
| Marketing version | `0.1.0` |
| Platform | iOS, iPhone only (`supportsTablet: false`) |
| Orientation | Portrait |
| Pilot | Tel Aviv-Yafo |

---

## Positioning

NestUp shows parents the families, activities, family-friendly places and
local events already around them, and helps them go together rather than
alone. The first pilot is in Tel Aviv-Yafo.

**NestUp is not affiliated with, operated by, or endorsed by the Tel Aviv
Municipality.** No submission field, screenshot or note may imply otherwise.
Public event data sourced from the municipal DigiTel feed is presented as
publicly available listings, never as a partnership.

No fabricated statistics, user counts, testimonials or partnerships appear
anywhere in this package.

---

## Store listing

**Subtitle** (30 char limit)

```
Parents & activities near you
```
*(29 characters. The natural phrasing "Parents and activities near you" is 31
and will be rejected — the ampersand is what makes it fit.)*

**Promotional text** (170 limit, editable without review)

```
Now opening in Tel Aviv-Yafo. Find activities, family-friendly places and local events near home, and see which parents are going.
```

**Description**

```
NestUp helps parents find the community that is already around them.

Instead of scrolling through city-wide noise, NestUp shows what is happening
close to home: activities other parents have created, family-friendly places
with the details that actually matter, and local events for families.

DISCOVER WHAT IS NEARBY
See activities, places and events around you on a map and in a list, sorted by
what is closest right now. Filter by what fits your family — babies, toddlers,
kids, indoor, outdoor, free or paid.

PLACES WITH THE DETAILS THAT MATTER
Playgrounds, parks, libraries, beaches and cafés, with the things parents
actually check first: shade, toilets, changing tables, high chairs, stroller
access and accessibility.

GO TOGETHER
Join an activity another parent created, or create your own in a minute. See
who else is coming before you decide.

A LOCAL COMMUNITY
Forums for the questions you would rather ask a neighbour than a search
engine, and chats for the activities you join.

BUILT FOR TEL AVIV, IN YOUR LANGUAGE
NestUp works in Hebrew, English, French and Russian, with full right-to-left
support in Hebrew.

NestUp is starting as a pilot in Tel Aviv-Yafo. NestUp is an independent app
and is not affiliated with or endorsed by the Tel Aviv Municipality.
```

**Keywords** (100 char limit, comma-separated, no spaces after commas)

```
parents,kids,family,toddler,playground,activities,meetup,tel aviv,community,local,events,baby
```
*(92 characters. Do not repeat words already in the app name or subtitle.)*

**Category** — Primary: Social Networking. Secondary: Lifestyle.

**URLs**

| Field | Value | Status |
|---|---|---|
| Support URL | `https://nestup.best/` | Live, verified 200 |
| Marketing URL | `https://nestup.best/` | Live, verified 200 |
| Privacy Policy URL | `https://ghzpzimcxvccbmjsttlf.supabase.co/storage/v1/object/public/legal/privacy.html` | Same document the app links to (`src/constants/legal.ts`) |

> Apple accepts the Supabase-hosted policy, but a `nestup.best/privacy` URL
> would look more credible to a reviewer. That is a website change, out of
> scope for this release.

---

## App Review notes

```
NestUp is a local discovery app for parents. This build is the Tel Aviv pilot
release candidate.

DEMO ACCOUNT
Email:    <fill in before submitting>
Password: <fill in before submitting>

The demo account already has a completed family profile, so the reviewer
reaches Discovery immediately after signing in.

SIGN-IN OPTIONS
Both email and Sign in with Apple are supported. Sign in with Apple is
offered alongside email because the app offers a third-party-free email
login; Apple Private Relay addresses are fully supported and are never shown
to other users.

FIRST RUN
On first launch the app asks for location permission so it can show what is
nearby. Permission is optional — if it is denied, Discovery falls back to the
Tel Aviv city centre and remains fully usable. Please allow it if possible so
the map and distances behave as designed.

WHAT TO LOOK AT
1. Discovery shows a map and a list of nearby activities, places and events.
   Search, Filters and Sort are in the toolbar above the list.
2. Tapping any card opens its detail screen. Back returns to Discovery.
3. Activities can be created from the + control and joined by other parents.
4. Forums and Chats are the community surfaces.
5. Profile contains language switching (Hebrew, English, French, Russian),
   children, and account controls including account deletion.

CONTENT
Event listings are ingested from the City of Tel Aviv-Yafo's publicly
available DigiTel event feed and are presented as public listings. NestUp is
an independent app and is not affiliated with or endorsed by the Tel Aviv
Municipality.

USER-GENERATED CONTENT
The app includes user-generated content (activities, chat messages, forum
posts, profile photos). It provides: a report control on user content and
profiles, user blocking, in-app account deletion, and a published terms
document that prohibits objectionable content. Reports are stored for review.

LANGUAGE
The pilot audience is Hebrew-speaking. To review in English, open Profile and
select English under language.
```

---

## Reviewer testing path

1. Launch, allow location when asked.
2. Sign in with the demo account above.
3. Discovery loads with map and nearby list.
4. Tap a place card → details → Back → pan the map.
5. Tap an event card → details → Back → pan the map.
6. Create an activity via `+`, complete the form, review, publish.
7. Open Chats → an activity conversation.
8. Open Forums → a forum thread.
9. Profile → switch language to English → confirm layout flips to LTR.
10. Profile → account deletion is present and reachable.

---

## App Privacy answers

Derived from what the app actually collects. Verify against the live schema
before submitting.

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes | Yes | No | Account authentication |
| Name | Yes | Yes | No | App functionality — shown to other parents |
| Photos | Yes, optional | Yes | No | Profile and activity cover images |
| Coarse/precise location | Yes, in use only | No | No | Showing nearby content |
| User content (messages, posts) | Yes | Yes | No | App functionality |
| Other data (children's age range, caregiver role, neighbourhood) | Yes | Yes | No | App functionality — matching families |
| Identifiers (user ID) | Yes | Yes | No | App functionality |
| Usage data | Yes | No | No | Analytics — product improvement |
| Diagnostics | No | — | — | — |

- **Tracking:** No. NestUp does not track users across apps or websites owned
  by other companies, and there is no advertising SDK. Answer "No" to the
  App Tracking Transparency question.
- **Children's data:** the app stores a child's age range and first name as
  entered by the parent. It is not directed at children and is not intended
  for use by anyone under 17.
- **Account deletion:** implemented in-app under Profile, which Apple requires
  for any app offering account creation.

---

## Age rating

Target: **17+**, because the app contains unmoderated user-generated content
and user-to-user communication.

| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Sexual content or nudity | None |
| Profanity or crude humour | None |
| Alcohol, tobacco, or drug use | None |
| Horror/fear themes | None |
| Gambling | None |
| Contests | None |
| Unrestricted web access | No |
| **User-generated content** | **Yes** |
| **Messaging / user-to-user** | **Yes** |
| Made for Kids | **No** |

---

## Screenshots — NOT READY

Apple requires, at minimum, screenshots for **6.9"** (1320×2868 or 1290×2796)
and **6.5"** (1242×2688 or 1284×2778). iPad is not required because the app
is iPhone-only.

Current status: the captures held in the project are **1206×2622** (iPhone 16
Pro), which matches neither required size. They cannot be uploaded as-is, and
they must not be upscaled — Apple rejects distorted screenshots, and padding
real captures into a larger frame reads as sloppy.

**This is the one blocking item for App Store submission.** It does not block
TestFlight, which needs no screenshots.

To resolve, capture on a 6.9" device or simulator (iPhone 16 Pro Max) and a
6.5" device or simulator (iPhone 11 Pro Max / XS Max), in Hebrew, of:

1. Discovery — map with pins, toolbar, bottom sheet of nearby results
2. Place details — a real Tel Aviv place with amenities visible
3. Activity details — showing who is going
4. Forums
5. Create activity

No mockups, no invented UI, no fabricated content.

---

## Pre-submission checklist

- [x] Support URL live
- [x] Marketing URL live
- [x] Privacy policy URL live
- [x] Age rating inputs decided
- [x] App Privacy answers drafted
- [x] Review notes drafted
- [x] Reviewer path drafted
- [x] No municipal partnership claimed anywhere
- [ ] **Demo account created and credentials filled into the review notes**
- [ ] **6.9" screenshots captured**
- [ ] **6.5" screenshots captured**
- [ ] Physical device validation passed (see `device-validation-checklist.md`)
