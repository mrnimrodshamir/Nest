import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inbox=readFileSync('supabase/migrations/20260822220000_operator_owner_inbox.sql','utf8');
const schedule=readFileSync('supabase/migrations/20260822221000_schedule_unified_operator.sql','utf8');
const runner=readFileSync('src/operator/scheduledRunner.ts','utf8');

test('owner inbox persists the complete request contract',()=>{for(const field of ['category','title','summary','why_now','recommended_action','risk_level','expected_impact','rollback_plan','agent_recommendation','operator_key'])assert.match(inbox,new RegExp(`add column if not exists ${field}`));assert.match(inbox,/status in \('APPROVE','REJECT','REQUEST_CHANGES'\)/);});
test('agents remain insert-only while allow-listed owners may decide pending requests',()=>{assert.match(inbox,/grant update\(status, decided_by, decided_at\).*to authenticated/i);assert.doesNotMatch(inbox,/grant update[^;]*approval_requests[^;]*to service_role/i);assert.match(inbox,/operator_owner_decide_pending_approval/);assert.match(inbox,/decided_by = auth\.uid\(\)/);});
test('exactly one Daily and one Weekly Green-only scheduler are declared',()=>{assert.equal((schedule.match(/perform cron\.schedule\(/g)??[]).length,2);assert.match(schedule,/'nestup-operator-daily',[\s\S]*'15 3 \* \* \*'/);assert.match(schedule,/'nestup-operator-weekly-source-hunt',[\s\S]*'30 3 \* \* 1'/);assert.match(schedule,/unschedule/);assert.doesNotMatch(schedule,/events\s+(?:set|delete|insert|update)|eas build|app store/i);});
test('scheduled runner has no owner-decision or self-approval path',()=>{assert.doesNotMatch(runner,/applyOwnerDecision|status:\s*'APPROVE'|status:\s*'REJECT'/);assert.match(runner,/status:'PENDING'/);});
