import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { runScheduledOperator } from '../../../src/operator/scheduledRunner.ts';
import type { OperatorMode } from '../../../src/operator/types.ts';
import { TEL_AVIV_SOURCE_CATALOG } from '../_shared/operator/sourceCatalog.ts';
import { createSupabaseOperatorStore } from '../_shared/operator/supabaseStore.ts';

export interface OperatorHandlerDependencies { client:SupabaseClient; now?:()=>Date }

export async function handleOperatorRequest(request:Request,deps:OperatorHandlerDependencies):Promise<Response>{
  if(request.method!=='POST')return response(405,{error:{code:'METHOD_NOT_ALLOWED'}});
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'';
  if(!token||!hasServiceRole(token))return response(401,{error:{code:'UNAUTHORIZED'}});
  let body:unknown;try{body=await request.json();}catch{return response(400,{error:{code:'INVALID_REQUEST'}});}
  const mode=(body as {mode?:unknown})?.mode;
  if(mode!=='daily'&&mode!=='source_hunt')return response(400,{error:{code:'INVALID_REQUEST'}});
  try{const report=await runScheduledOperator(mode as OperatorMode,createSupabaseOperatorStore(deps.client),{now:deps.now?.(),sourceCatalog:TEL_AVIV_SOURCE_CATALOG,scheduled:(body as {scheduled?:unknown}).scheduled===true});return response(200,{ok:true,mode:report.mode,productHealth:report.productHealth,contentHealth:report.contentHealth,findings:report.findings.length,approvalsCreated:report.approvalsCreated.length});}
  catch{return response(500,{error:{code:'OPERATOR_RUN_FAILED'}});}
}

function response(status:number,body:unknown):Response{return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
function hasServiceRole(token:string):boolean{try{const payload=token.split('.')[1];if(!payload)return false;const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');return JSON.parse(atob(normalized)).role==='service_role';}catch{return false;}}
