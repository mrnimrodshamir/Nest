# Build 33 deferred product work

These items were deliberately excluded from the Build 33 crash/UX hotfix.

## Event content translation

DigiTel titles and descriptions should continue to display in their source
language until a product decision is made. A future design may store optional
translated copy per locale, cache it by source revision, and retain translation
provider/model provenance. The design must cover cost limits, user privacy, stale
translation invalidation, and an explicit fallback to the source text.

## Forum image uploads

Forum images require a separate storage and moderation design. Before enabling
uploads, define client compression, file/type/dimension limits, abuse review and
removal, storage retention, and bandwidth controls. No upload surface or storage
policy is part of this hotfix.
