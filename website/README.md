# nestup.best — landing page

A static marketing site. No framework, no build step, no backend.

```
website/
  index.html        the whole page
  styles.css        design tokens copied from src/theme/colors.ts
  robots.txt
  sitemap.xml
  assets/           web-sized brand images
  build-assets.py   regenerates assets/ from the app's 1024px master icon
```

## Editing

Open `index.html` and change the text. That is the whole workflow — there is
nothing to compile and nothing to install.

Colour tokens live at the top of `styles.css` and are copied verbatim from
`src/theme/colors.ts`. If the app rebrands, update them in both places.

## Why plain HTML

The brief asked for fast, mobile-first, good SEO, simple deployment and easy
future editing. A framework would have added a build step, a dependency tree and
a hydration payload to a page that is a few hundred words of text. This version
is one HTML file plus one stylesheet: a single round trip, no JavaScript
required to render, and legible to any search crawler without executing
anything.

## Assets

`build-assets.py` derives every image from `assets/icon.png` in the app. The
master is 1024x1024 because the App Store requires it — serving that to a phone
for a 40px logo costs ~770KB, so each size is generated instead:

```bash
python build-assets.py
```

Total asset weight is ~181KB, of which only ~24KB loads on first paint (the
56/112px marks). `og-card.png` is fetched only by link-preview crawlers.

## Paths are relative, deliberately

Root-absolute paths (`/styles.css`) only resolve when the page is served from a
domain root. The site is flat, so relative paths work identically in production,
from the filesystem, and from a subpath — which makes local preview and staging
behave the same as production.

## Legal

The footer links to the SAME privacy and terms documents the iOS app uses
(`src/constants/legal.ts`), rather than hosting a second copy here that would
silently drift out of date.

## Deployment — NOT YET DONE

Nothing has been deployed and no DNS record has been changed.

The site is a folder of static files, so it can go on any static host. The
decision that has to be made first is **where**, because it determines the DNS
records:

| Host | DNS needed | Notes |
|---|---|---|
| Netlify / Vercel / Cloudflare Pages | `CNAME` (or their apex ALIAS) | Free tier, automatic TLS, deploy from git |
| GitHub Pages | 4 × `A` records to GitHub's IPs, or `CNAME` on `www` | Free, needs the repo public or Pro |
| Spaceship hosting | per their panel | Domain and hosting in one account |

Once chosen:

1. Point the host at `website/` as the publish directory.
2. Add the DNS records at Spaceship for `nestup.best` (and `www`).
3. Confirm TLS is issued before announcing the URL.

**Credentials never live in this folder.** The Spaceship API key and secret
belong in the gitignored `.env` at the repo root, read from the environment at
deploy time. `.gitignore` covers `.env*`, so a `.env.production` cannot be
committed by accident.
