import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script=readFileSync('scripts/run-nestup-operator.mjs','utf8');
const policy=readFileSync('src/operator/policy.ts','utf8');

test('operator persistence is isolated to the existing agent control plane',()=>{
  const inserts=[...script.matchAll(/insert into public\.([a-z_]+)/g)].map((match)=>match[1]);
  assert.deepEqual([...new Set(inserts)].sort(),['agent_artifacts','agent_tasks','city_expansion_runs']);
  assert.doesNotMatch(script,/(insert|update|delete)\s+(?:into|from)?\s*public\.(events|event_occurrences|event_attendees|activities|profiles)/i);
});
test('operator has no scheduler or production release path',()=>{assert.doesNotMatch(script,/cron\.schedule|eas build|app store|testflight/i);});
test('red actions are executable policy, not prose only',()=>{for(const action of ['weaken_rls','delete_user_data','delete_rsvp_data','force_push','app_store_submission']) assert.match(policy,new RegExp(action));});
