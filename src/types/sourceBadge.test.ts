import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceBadgeForActivity, sourceBadgeForEvent } from './sourceBadge.ts';

test('a municipal event badge carries the municipality name and its base URL', () => {
  const badge = sourceBadgeForEvent({
    sourceType: 'municipal', sourceName: 'עיריית תל אביב-יפו', providerUrl: 'https://www.tel-aviv.gov.il',
  });
  assert.deepEqual(badge, { kind: 'municipal', label: 'עיריית תל אביב-יפו', providerUrl: 'https://www.tel-aviv.gov.il' });
});

test('an external organizer event badge is labeled distinctly from municipal — never the municipality name', () => {
  const badge = sourceBadgeForEvent({
    sourceType: 'external_organizer', sourceName: 'בית אריאלה וספריות תל אביב-יפו', providerUrl: 'https://ariela.today',
  });
  assert.equal(badge.kind, 'external_organizer');
  assert.notEqual(badge.label, 'עיריית תל אביב-יפו');
});

test('a NestUp community Activity badge has no provider label or URL — there is no external source to attribute', () => {
  const badge = sourceBadgeForActivity();
  assert.deepEqual(badge, { kind: 'nestup_community', label: null, providerUrl: null });
});

test('the three kinds are mutually exclusive — an Event badge is never nestup_community', () => {
  const municipal = sourceBadgeForEvent({ sourceType: 'municipal', sourceName: 'x', providerUrl: null });
  const external = sourceBadgeForEvent({ sourceType: 'external_organizer', sourceName: 'x', providerUrl: null });
  assert.notEqual(municipal.kind, 'nestup_community');
  assert.notEqual(external.kind, 'nestup_community');
});
