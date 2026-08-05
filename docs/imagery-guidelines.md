# Imagery guidelines

## Decision: illustration, not photography, not AI-generated people

App-owned decorative imagery — onboarding screens, empty states, marketing
surfaces — uses **custom illustration** (soft, abstract, silhouette-based;
see the sage/sand/sky palette in `theme/colors.ts`).

**Not stock/licensed photography**: sourcing authentic, diverse photography
before launch is slow and expensive, and generic "diverse mothers" stock
photography reads as stock photography — it works against the "no generic
layouts" principle rather than for it.

**Not AI-generated photorealistic people**: NestUp's core value proposition is
*real people, real friendships*. Populating the app's own marketing and
empty states with fake AI faces sits in direct tension with that promise,
and photoreal AI people are still recognizable as such (skin texture,
hands, eyes) in ways that read as cheap rather than premium once noticed.

Abstract illustration sidesteps both problems: it's honestly illustrated
rather than claiming to be real, it's cheaper than a photoshoot, and —
because figures are intentionally abstract/faceless — it can't
under-represent anyone the way a finite set of stock photos or AI faces
inevitably would.

## What this does NOT apply to

**User profile photos are always real photographs** — the person's own
uploaded photo. This guideline only governs imagery the app itself
supplies (onboarding illustrations, empty-state graphics, marketing
assets), never user-generated content.

## Production notes

Commission illustrations from a single illustrator/studio rather than
generating them ad hoc, so linework, proportions, and color usage stay
consistent across the full set (roughly 8-10 scenes needed for MVP:
onboarding steps 1-4, Discover empty state, Chat empty state, Host
success state, verification prompt).
