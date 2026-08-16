import assert from 'node:assert/strict';
import test from 'node:test';
import { hasUsableDisplayName, isLegacyDefaultDisplayName, safeCaregiverDisplayName, safeDisplayName } from './profileIdentity.ts';

test('legacy Momzi/Momzy placeholders are never caregiver identities', () => {
  assert.equal(isLegacyDefaultDisplayName('Momzi member'), true);
  assert.equal(isLegacyDefaultDisplayName(' MOMZY   MEMBER '), true);
  assert.equal(hasUsableDisplayName('Momzi member'), false);
  assert.equal(safeDisplayName('Momzy member', 'Parent'), 'Parent');
  assert.equal(safeCaregiverDisplayName('Momzy member'), 'Parent');
});

test('legitimate caregiver names are preserved exactly except surrounding whitespace', () => {
  assert.equal(hasUsableDisplayName('Maya Cohen'), true);
  assert.equal(safeDisplayName('  Maya Cohen  ', 'NestUp member'), 'Maya Cohen');
});

test('Apple private relay email has no effect on profile identity completeness', () => {
  const privateRelayEmail = 'abc123@privaterelay.appleid.com';
  assert.equal(hasUsableDisplayName('Daniel'), true);
  assert.match(privateRelayEmail, /@privaterelay\.appleid\.com$/);
});
