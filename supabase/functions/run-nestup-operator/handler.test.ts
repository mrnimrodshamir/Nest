import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOperatorRequest } from './handler.ts';

const unusedClient={} as never;
const jwt=(role:string)=>`header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
test('operator endpoint rejects missing authentication',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',body:'{"mode":"daily"}'}),{client:unusedClient});assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:{code:'UNAUTHORIZED'}});});
test('operator endpoint rejects an authenticated non-service role',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',headers:{authorization:`Bearer ${jwt('authenticated')}`},body:'{"mode":"daily"}'}),{client:unusedClient});assert.equal(response.status,401);});
test('operator endpoint rejects non-scheduled modes before touching the store',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',headers:{authorization:`Bearer ${jwt('service_role')}`},body:'{"mode":"deep_audit"}'}),{client:unusedClient});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'INVALID_REQUEST'}});});
test('operator endpoint never returns upstream or credential detail for malformed input',async()=>{const response=await handleOperatorRequest(new Request('https://example.com',{method:'POST',headers:{authorization:`Bearer ${jwt('service_role')}`},body:'not-json'}),{client:unusedClient});assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/secret|stack|service.role/i);});
