// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AppleMapsClient } from './appleMapsClient.ts';
import { handlePlaceRequest } from './handler.ts';
import { AppleMapsTokenService, readAppleTokenConfiguration } from './tokenService.ts';

let appleClient: AppleMapsClient | null = null;

function getAppleClient(): AppleMapsClient {
  if (!appleClient) {
    const configuration = readAppleTokenConfiguration((name) => Deno.env.get(name));
    appleClient = new AppleMapsClient(new AppleMapsTokenService(configuration));
  }
  return appleClient;
}

Deno.serve((request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return handlePlaceRequest(request, {
    authenticate: async (authorization) => {
      if (!supabaseUrl || !anonKey || !authorization) return false;
      const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      return !error && Boolean(data.user);
    },
    consumeRateLimit: async (authorization) => {
      const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await client.rpc('consume_place_search_rate_limit');
      return !error && data === true;
    },
    executeAppleRequest: (validated) => getAppleClient().execute(validated),
  });
});

