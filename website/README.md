# nestup.best — landing page

A three-section marketing site: hero, one product-proof section, a closing
call to action. Static HTML and CSS, plus one serverless function for beta
signups.

```
website/
  index.html        the whole page
  styles.css        design tokens copied from src/theme/colors.ts
  join.js           the beta-signup interaction (~3KB, deferred)
  api/subscribe.js  serverless endpoint: stores the lead, then notifies
  robots.txt
  sitemap.xml
  assets/           web-sized brand images, product screenshots, display font
  build-assets.py   regenerates images from the app's 1024px master icon
  build-font.py     regenerates the subset display font
```

## Editing

Open `index.html` and change the text. There is no build step for the page
itself; the two Python scripts only need re-running when the source images or
the headline glyph set change.

Colour tokens live at the top of `styles.css` and are copied verbatim from
`src/theme/colors.ts`. If the app rebrands, update them in both places.

## Beta signup

`POST /api/subscribe` with `{"email": "..."}`.

The endpoint does two jobs, deliberately in this order:

1. **Store the lead** in Vercel Blob at `leads/<sha256(email)>.json`. This is
   the source of truth. The pathname is derived from the address, so a repeat
   submission overwrites rather than creating a second record.
2. **Notify** `nimrodshamir@nestup.best` via Resend. Best-effort — a failure
   here is logged and swallowed, because the lead is already safe and the
   person signing up should not see an error for our mail problem.

Rejected without storing: malformed addresses, anything that fills the
honeypot field, and anything submitted less than 1.5s after page load.

### Reading the leads

```bash
vercel blob list --prefix leads/ --rw-token "$BLOB_READ_WRITE_TOKEN"
vercel blob get leads/<id>.json --access private --rw-token "$BLOB_READ_WRITE_TOKEN"
```

The token is in the project's environment; `vercel env pull` writes it to the
gitignored `.env.local`.

### Enabling email notification

Storage works with no configuration. Email needs one variable:

```bash
vercel env add RESEND_API_KEY production
vercel deploy --prod
```

Until it is set, signups are still captured and the function logs a warning.

With a fresh Resend account and no verified domain, the only permitted sender
is `onboarding@resend.dev` and the only permitted recipient is the address
that owns the account — so sign up **as `nimrodshamir@nestup.best`** and no
DNS change is needed. To send from a `@nestup.best` address later, verify the
domain in Resend and set `RESEND_FROM`; that adds DNS records and must not
disturb the existing Spacemail MX/SPF/DKIM entries.

**No credential belongs in this folder.** `.gitignore` covers `.env*`, so the
blob token and API key cannot be committed by accident.

## Product screenshots are real

Every screen shown on the page is a genuine device capture from the shipping
build, resized and re-encoded by `build-assets.py`. The page must never show
an invented or mocked-up NestUp interface — if the right screen does not
exist yet, the section ships without it.

## The display font

`build-font.py` downloads Fraunces, pins it to a single instance (the axes are
fixed, so it stops being a variable font) and subsets it to the glyphs the
copy uses. That takes it from 118KB to ~10KB. Headlines only; body text uses
the system stack, which costs nothing and reads better at small sizes.

## Why plain HTML

The page is a few hundred words and three images. A framework would add a
build step, a dependency tree and a hydration payload to that. This version
renders with no JavaScript at all — `join.js` only upgrades the signup
interaction — and is legible to any crawler without executing anything.

## Paths are relative, deliberately

Root-absolute paths (`/styles.css`) only resolve when the page is served from
a domain root. The site is flat, so relative paths work identically in
production, from the filesystem, and from a subpath — which makes local
preview and staging behave the same as production.

## Legal

The footer links to the SAME privacy and terms documents the iOS app uses
(`src/constants/legal.ts`), rather than hosting a second copy here that would
silently drift out of date.

## Deployment

Vercel project `nestup`, aliased to `nestup.best`.

```bash
vercel deploy --prod
```

DNS lives at Spaceship: an apex `A` record to Vercel. The nameservers stay
with Spaceship so the Spacemail MX, SPF and DKIM records keep working —
switching to Vercel's nameservers would break mail.
