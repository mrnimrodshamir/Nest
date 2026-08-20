import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsInDigestOrder } from './dailyDigestRows.ts';

test('preserves ranking rather than unstable database order', () => {
  const rows = [{ occurrence_id: 'b' }, { occurrence_id: 'missing' }, { occurrence_id: 'a' }];
  assert.deepEqual(rowsInDigestOrder(rows, ['a', 'b', 'gone']).map((row) => row.occurrence_id), ['a', 'b']);
});
