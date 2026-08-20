// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runDigest, type DigestDatabase, type DigestPeriod, type PushSender, type PushSendOutcome } from './handler.ts';
import type { DigestCandidateOccurrence } from '../_shared/dailyDigest/selectDigestEvents.ts';
import { addLocalCalendarDays, isDailyDigestSendWindow, isWeeklyDigestSendWindow } from '../_shared/dailyDigest/scheduleGate.ts';
import type { DigestType } from '../_shared/dailyDigest/idempotency.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!isServiceRole(request.headers.get('authorization'))) return response(403, { error: 'FORBIDDEN' });

  let body: unknown;
  try { body = await request.json(); } catch { return response(400, { error: 'INVALID_REQUEST' }); }
  if (!isRequestBody(body)) return response(400, { error: 'INVALID_REQUEST' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return response(500, { error: 'CONFIGURATION_MISSING' });
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const now = new Date();
  const digestType: DigestType = body.digestType ?? 'daily';
  // Both schedules tick every 15 minutes. Their separate DST-aware gates
  // ensure Daily remains 07:00 and Weekly remains Saturday 19:00 Jerusalem.
  const isSendWindow = digestType === 'weekly'
    ? isWeeklyDigestSendWindow(now)
    : isDailyDigestSendWindow(now);
  if (!body.force && !isSendWindow) {
    return response(200, { skipped: 'OUTSIDE_SEND_WINDOW', now: now.toISOString() });
  }

  try {
    const result = await runDigest({ dryRun: body.dryRun, now, digestType, weekStart: body.weekStart }, createDatabase(client), createPushSender());
    return response(200, result);
  } catch (error) {
    return response(502, { error: 'DIGEST_RUN_FAILED', message: error instanceof Error ? error.message : String(error) });
  }
});

function createDatabase(client: any): DigestDatabase {
  return {
    async fetchCandidates(period: DigestPeriod): Promise<DigestCandidateOccurrence[]> {
      // A deliberately generous UTC window. The pure selection engine owns
      // exact Jerusalem-local day boundaries, including DST transitions.
      const windowStart = `${addLocalCalendarDays(period.startDate, -1)}T00:00:00.000Z`;
      const windowEnd = `${addLocalCalendarDays(period.endDate, 2)}T00:00:00.000Z`;
      const { data, error } = await client
        .from('active_event_occurrences')
        .select('occurrence_id,event_id,title,description,category,starts_at,age_min_months,age_max_months,price_note,provider,provider_event_id,source_name,source_url,source_type,canonical_event_id,latitude,longitude,location_name,formatted_address')
        .gte('starts_at', windowStart)
        .lte('starts_at', windowEnd);
      if (error) throw new Error(`Could not load digest candidate occurrences: ${error.message}`);
      return (data ?? []).map((row: any) => ({
        occurrenceId: row.occurrence_id,
        eventId: row.event_id,
        title: row.title,
        description: row.description,
        category: row.category,
        startsAt: row.starts_at,
        ageMinMonths: row.age_min_months,
        ageMaxMonths: row.age_max_months,
        priceNote: row.price_note,
        provider: row.provider,
        providerEventId: row.provider_event_id,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        sourceType: row.source_type,
        canonicalEventId: row.canonical_event_id,
        latitude: row.latitude,
        longitude: row.longitude,
        locationName: row.location_name,
        formattedAddress: row.formatted_address,
      }));
    },
    async fetchEligibleUsers(digestType: DigestType = 'daily') {
      // One row per opted-in user. A missing token stays visible to the dry
      // run as an explicit skip instead of disappearing from eligibility
      // totals. For multiple devices we intentionally choose the newest
      // valid Expo token so the daily digest is one push per user/day.
      const { data, error } = await client
        .from('profiles')
        .select('id, locale, push_tokens(token,created_at)')
        .eq(`notification_preferences->>${digestType === 'weekly' ? 'weekly_digest' : 'daily_digest'}`, 'true');
      if (error) throw new Error(`Could not load eligible digest users: ${error.message}`);
      const users: { userId: string; expoPushToken: string | null; locale: string | null }[] = [];
      for (const row of data ?? []) {
        const tokens = (Array.isArray(row.push_tokens) ? row.push_tokens : [row.push_tokens])
          .filter((entry: any) => isExpoPushToken(entry?.token))
          .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
        users.push({ userId: row.id, expoPushToken: tokens[0]?.token ?? null, locale: row.locale });
      }
      return users.sort((a, b) => a.userId.localeCompare(b.userId));
    },
    async hasAlreadySent(sendKey: string) {
      const { data, error } = await client.from('daily_digest_sends').select('id').eq('send_key', sendKey).maybeSingle();
      if (error) throw new Error(`Could not check digest idempotency: ${error.message}`);
      return !!data;
    },
    async recordDigestInstance(input) {
      const { data, error } = await client.from('daily_digest_instances').upsert({
        digest_type: input.digestType ?? 'daily',
        digest_date: input.anchorDate ?? input.localDate,
        city: input.city,
        selected_occurrence_ids: input.selectedOccurrenceIds,
        selection_version: input.selectionVersion,
      }, { onConflict: 'digest_type,digest_date,city' }).select('id').single();
      if (error) throw new Error(`Could not record digest instance: ${error.message}`);
      return data.id;
    },
    async claimSend(input) {
      // The row is inserted BEFORE calling Expo. The unique key makes this
      // an atomic at-most-once claim across concurrent Edge Function isolates.
      const { error } = await client.from('daily_digest_sends').insert({
        send_key: input.sendKey,
        user_id: input.userId,
        digest_id: input.digestId,
        digest_date: input.localDate,
        digest_type: input.digestType ?? 'daily',
        status: 'claimed',
      });
      if (error?.code === '23505') return false;
      if (error) throw new Error(`Could not claim digest send: ${error.message}`);
      return true;
    },
    async markSendSucceeded(sendKey) {
      const { error } = await client.from('daily_digest_sends').update({ status: 'sent', sent_at: new Date().toISOString(), failure_code: null }).eq('send_key', sendKey);
      if (error) throw new Error(`Could not complete digest send: ${error.message}`);
    },
    async markSendFailed(sendKey, failureCode) {
      // Retain the claim on ambiguous network/provider failure. Retrying an
      // unknown outcome risks a duplicate notification; at-most-once is the
      // safer daily-digest policy.
      const { error } = await client.from('daily_digest_sends').update({ status: 'failed', failure_code: failureCode }).eq('send_key', sendKey);
      if (error) throw new Error(`Could not mark digest failure: ${error.message}`);
    },
    async removeInvalidPushToken(userId, token) {
      const { error } = await client.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
      if (error) throw new Error(`Could not remove invalid push token: ${error.message}`);
    },
    async trackAnalytics(eventName, properties) {
      // Server-side analytics insert has no user_id column populated here on
      // purpose for aggregate events (daily_digest_generated) — per-user
      // events pass locale/date only, never child/profile/email/token data.
      const { error } = await client.from('analytics_events').insert({ event_name: eventName, properties });
      if (error) console.log(`[send-daily-digest] analytics insert failed for ${eventName}: ${error.message}`);
    },
  };
}

function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value);
}

function createPushSender(): PushSender {
  return {
    async send(messages): Promise<PushSendOutcome[]> {
      if (messages.length === 0) return [];
      const outcomes: PushSendOutcome[] = [];
      // Expo accepts at most 100 messages per request. Keep each chunk
      // positional and continue after one chunk fails so partial delivery is
      // visible rather than silently truncating the audience.
      for (let offset = 0; offset < messages.length; offset += 100) {
        const chunk = messages.slice(offset, offset + 100);
        try {
          const res = await fetch(EXPO_PUSH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(chunk),
            signal: AbortSignal.timeout(20_000),
          });
          const json = await res.json().catch(() => null);
          const tickets = Array.isArray(json?.data) ? json.data : [];
          outcomes.push(...chunk.map((_message, index) => {
            const ticket = tickets[index];
            if (ticket?.status === 'ok') return { status: 'ok' as const };
            const errorType = ticket?.details?.error;
            return {
              status: errorType === 'DeviceNotRegistered' ? ('invalid_token' as const) : ('error' as const),
              message: ticket?.message ?? 'Expo push API did not return a ticket',
            };
          }));
        } catch (error) {
          outcomes.push(...chunk.map(() => ({
            status: 'error' as const,
            message: error instanceof Error ? error.message : 'Expo push request failed',
          })));
        }
      }
      return outcomes;
    },
  };
}

function isRequestBody(value: unknown): value is { dryRun: boolean; force?: boolean; digestType?: DigestType; weekStart?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (typeof v.dryRun !== 'boolean') return false;
  if (keys.some((key) => !['dryRun', 'force', 'digestType', 'weekStart'].includes(key))) return false;
  if ('force' in v && typeof v.force !== 'boolean') return false;
  if ('digestType' in v && v.digestType !== 'daily' && v.digestType !== 'weekly') return false;
  if ('weekStart' in v) {
    if (v.digestType !== 'weekly' || typeof v.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.weekStart)) return false;
  }
  return true;
}

function isServiceRole(authorization: string | null): boolean {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))));
    return payload.role === 'service_role';
  } catch { return false; }
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
