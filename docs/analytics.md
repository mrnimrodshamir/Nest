# NestUp product analytics

## Provider and architecture

NestUp retains its existing internal Supabase analytics store. The mobile app
depends only on the vendor-neutral `analytics.track`, `analytics.identify`, and
`analytics.screen` contract. No additional analytics SDK, native integration,
account, API key, or bundle dependency is required.

The live `analytics_events` table exists in the same Supabase project and has
row-level security enabled. Delivery is fire-and-forget: offline state, missing
sessions, RLS failures, and backend errors cannot block or reject product
actions.

## Events

The release funnel covers app/opening and onboarding, login, language changes,
Discovery open/search/filter/sort/item open, Activity open/create/join/leave/share,
Event open/RSVP/share, Place open/share, Chats and Forums, Public Profile opens,
profile updates, and share start/completion/cancellation/failure by channel.

## Privacy contract

The backing store may use the authenticated Supabase user ID as an internal,
RLS-protected ownership key. It is never copied into event properties and is
never sent to an external analytics vendor.

Properties currently sent are limited to:

- content type and internal content ID where needed for a funnel;
- source classification such as `user`, `curated`, or provider name;
- language preference;
- share channel;
- forum catalogue key;
- Discovery mode, filter/sort key, and search query length (never query text);
- small non-sensitive state such as counts or boolean flags.

The sanitizer drops keys for email, phone, exact or derived birthdate fields,
child names, message content, bios, precise coordinates, addresses, credentials,
tokens, secrets, and passwords. Strings and property counts are bounded. No
user-generated text or full objects are sent.
