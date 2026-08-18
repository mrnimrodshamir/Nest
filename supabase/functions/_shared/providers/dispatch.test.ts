import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderEnabled, ProviderDisabledError } from './dispatch.ts';

test('an enabled provider passes without throwing', () => {
  assert.doesNotThrow(() => assertProviderEnabled({ key: 'tel_aviv_digitel', enabled: true }));
});

test('a disabled provider — Beit Ariela, until reviewed — throws before any fetch would happen', () => {
  assert.throws(
    () => assertProviderEnabled({ key: 'beit_ariela_libraries', enabled: false }),
    ProviderDisabledError,
  );
});

test('an unknown provider (no registry row at all) also throws, fail-closed', () => {
  assert.throws(() => assertProviderEnabled(null), ProviderDisabledError);
});

test('the error names the specific disabled provider, for a legible ops log', () => {
  try {
    assertProviderEnabled({ key: 'beit_ariela_libraries', enabled: false });
    assert.fail('expected a throw');
  } catch (error) {
    assert.match((error as Error).message, /beit_ariela_libraries/);
  }
});
