/** Generic provider relevance — a re-export, not a second copy.
 *
 *  The family-relevance engine lives in digitel/relevance.ts and was
 *  generalized in place to accept optional per-provider hints, rather than
 *  forked here. Every existing DigiTel call site is unaffected: hints default
 *  to nothing extra, proven unchanged by digitel/relevance.test.ts (45 tests,
 *  all passing before and after). This file exists only so provider code
 *  importing from `providers/` does not need to know the engine happens to
 *  live in a directory named after its first user. */
export {
  assessFamilyRelevance,
  isFamilyRelevant,
  type RelevanceDecision,
  type RelevanceHints,
} from '../digitel/relevance.ts';
