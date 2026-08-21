import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOperatorRequest } from './handler.ts';

const url=Deno.env.get('SUPABASE_URL')??'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

Deno.serve((request)=>handleOperatorRequest(request,{serviceRoleKey:key,client}));
