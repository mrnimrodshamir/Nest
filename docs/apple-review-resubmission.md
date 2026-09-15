# Apple Review resubmission checklist

Review reference: `1662db2a-46c9-453b-9030-ece368d76c4e`, version 1.0 (42).

Live App Store Connect verification on 2026-09-15: App Privacy reports
"Published 10 days ago by Nimrod Shamir". Its product-page preview contains
**Data Linked to You** and no **Data Used to Track You** section. The eight
declared data types show collection purposes and identity linkage, with no
tracking use. The tracking-label correction below is already completed; no
privacy answers were changed during this verification. The pending distribution
version still selects rejected build 42. Replace that binary only after the
remediation build has been physically validated.

## App Store Connect actions for the account owner

### App Privacy

Open NestUp → App Privacy and correct the **Used for Tracking** answers. The
inspected mobile code contains first-party Supabase analytics, not advertising,
cross-company advertising measurement, IDFA collection, or data-broker sharing.
An ATT prompt is therefore not the remedy for the reported privacy-label mismatch.

For each type Apple identified, answer **No** to use for tracking:

- Precise Location
- Coarse Location
- Name
- Product Interaction
- Crash Data
- Performance Data
- Other Diagnostic Data

This does **not** mean all these types are collected. Review the collection answers
separately: retain disclosures for actual account, user-content, location and
first-party analytics collection. Product Interaction is linked to the signed-in
user in the analytics table; do not label it anonymous. The inspected app has no
dedicated crash/performance telemetry SDK. Verify any separately configured
telemetry before retaining or removing those diagnostic collection declarations.

Save/publish the corrected answers and confirm the preview has no **Data Used to
Track You** section. Do not choose **Data Not Collected** for the whole app.

Apple references:

- https://developer.apple.com/app-store/user-privacy-and-data-use/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy

### Location clarification

Ask the reviewer to reassess the nearby-user location finding. Discovery renders
Activity, Place and Event markers. The map's blue dot is the current device's own
location. The inspected implementation does not publish other parents' live
device locations or implement automatic check-ins. User-created activity meeting
points are intentionally published content locations, not live attendee locations.

Do not claim that no location is collected. Do not change the age rating solely
to concede a feature the app does not have; keep the age-rating questionnaire
accurate and obtain Apple's clarification if this concern remains.

## Physical-device evidence required before resubmission

Use the next approved binary that includes the Apple P0 branch and pre-auth terms
gate. The rejected build 42 predates these changes. No new build is created by
this documentation task.

Use dedicated test accounts, not unsuspecting production users. Capture a single
clear recording on a physical iPhone:

1. Launch signed out. Show Terms and Privacy links and open the Terms page. Confirm
   authentication is unavailable until the agreement checkbox is selected and
   **Agree and continue** is pressed.
2. Demonstrate email or Apple authentication. If server-recorded acceptance is
   still required for this account, complete that consent screen too. Pre-auth
   acknowledgement deliberately does not impersonate authenticated acceptance.
3. Open a test activity's safety menu and report it with a reason. Also demonstrate
   long-pressing another test account's chat/forum message to report it.
4. Open the test member's profile safety menu and block them. Show their content
   and direct conversation disappearing. Force-close and reopen the app; confirm
   the blocked direct conversation stays hidden.
5. Show Discovery's Activity, Place and Event pins opening their content details.
   Explain that the blue dot belongs only to the reviewing device.

Attach the recording in the App Review conversation and include an accessible
recording link/reference in App Review Information → Notes as Apple requested.
Provide working reviewer credentials in App Store Connect's reviewer sign-in
fields. Never put credentials in this repository or a public recording.

## Operational responsibility

Assign a person to review incoming reports and block-generated moderation signals
and take timely action. A database moderation queue by itself does not establish
that someone is monitoring it. Confirm the support mailbox
`nimrodshamir@nestup.best` is monitored.

## Reply draft — send only after the stated actions are completed

> We have corrected our App Privacy answers. NestUp does not link user data with
> other companies' data for targeted advertising or advertising measurement and
> does not share it with data brokers. Our first-party usage analytics remain
> disclosed; no data is used for tracking as defined by ATT.
>
> The replacement build includes Terms and Privacy presented before authentication,
> content reporting, and blocking. Blocking removes the affected content from the
> viewer's feed, persists across app restarts, restricts communication, and records
> a moderation signal for developer review. The attached physical-device recording
> demonstrates these flows.
>
> Regarding map locations: NestUp displays activity meeting points, curated venues,
> and official event venues. It does not display other users' live device locations.
> The blue location indicator shows only the current device's own location. There
> are no automatic or live user check-ins. Please reassess the nearby-user location
> finding in light of this behavior and the recording.
>
> Terms: https://nestup.best/terms
> Privacy: https://nestup.best/privacy
> Support: nimrodshamir@nestup.best

Do not submit this draft with unverified claims about a replacement binary or
recording. Build creation, upload and public App Review submission remain separate
release actions requiring approval.
