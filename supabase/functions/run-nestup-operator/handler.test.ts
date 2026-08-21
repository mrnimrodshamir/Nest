import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOperatorRequest } from './handler.ts';

const unusedClient={} as never;
test('operator endpoint rejects missing authentication',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',body:'{"mode":"daily"}'}),{serviceRoleKey:'secret',client:unusedClient});assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:{code:'UNAUTHORIZED'}});});
test('operator endpoint rejects non-scheduled modes before touching the store',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer secret'},body:'{"mode":"deep_audit"}'}),{serviceRoleKey:'secret',client:unusedClient});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'INVALID_REQUEST'}});});
test('operator endpoint never returns upstream or credential detail for malformed input',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer secret'},body:'not-json'}),{serviceRoleKey:'secret',client:unusedClient});assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/secret|stack|service.role/i);});
