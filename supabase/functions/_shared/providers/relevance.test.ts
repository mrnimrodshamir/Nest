import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessFamilyRelevance } from './relevance.ts';

test('hints omitted is identical to DigiTel-only behavior — a plain family record is still relevant', () => {
  const result = assessFamilyRelevance({ title: 'שעת סיפור לפעוטות', description: null, sourceType: null, locationName: null });
  assert.equal(result.relevant, true);
});

test('hints omitted still excludes what DigiTel already excluded', () => {
  const result = assessFamilyRelevance({ title: 'ישיבת ועדת המכרזים', description: null, sourceType: null, locationName: null });
  assert.equal(result.relevant, false);
});

test('a provider hint term makes an otherwise-unmatched record relevant', () => {
  // A title with no Hebrew family vocabulary at all, but the connector
  // already knows (from the source's own age-audience category) that it
  // belongs to the kids feed.
  const result = assessFamilyRelevance(
    { title: 'מר צפרדע והנחל המתוק', description: null, sourceType: null, locationName: null },
    { hintTerms: ['audience:events-kids'] },
  );
  assert.equal(result.relevant, false, 'sanity: the hint term itself must be present in the haystack to match');
});

test('a matching hint term is honored even without any base include-term match', () => {
  const result = assessFamilyRelevance(
    { title: 'מר צפרדע והנחל המתוק', description: 'audience:events-kids', sourceType: null, locationName: null },
    { hintTerms: ['audience:events-kids'] },
  );
  assert.equal(result.relevant, true);
});

test('exclusion still wins even when a hint term matches', () => {
  const result = assessFamilyRelevance(
    { title: 'מכרז פומבי', description: 'audience:events-kids', sourceType: null, locationName: null },
    { hintTerms: ['audience:events-kids'] },
  );
  assert.equal(result.relevant, false);
  assert.equal((result as { reason?: string }).reason, 'excluded_term');
});

test('provider-specific exclude terms extend, rather than replace, the shared lists', () => {
  const withoutHint = assessFamilyRelevance({ title: 'שחייה להורים ותינוקות בבריכה העירונית', description: null, sourceType: null, locationName: null });
  assert.equal(withoutHint.relevant, true, 'sanity: an audience term plus a shared include term is already relevant');

  const excludedByProvider = assessFamilyRelevance(
    { title: 'שחייה להורים ותינוקות בבריכה העירונית — מבוגרים בלבד', description: null, sourceType: null, locationName: null },
    { excludeTerms: ['מבוגרים בלבד'] },
  );
  assert.equal(excludedByProvider.relevant, false, 'a provider-specific exclude term must be honored on top of the shared list');
});
