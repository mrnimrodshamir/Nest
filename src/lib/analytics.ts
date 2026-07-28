import { supabase } from '@/lib/supabase';

/** Event names this app tracks. Deliberately small and behavioral —
 *  no message content, no free-text fields, nothing beyond what's needed
 *  to see the core funnel (sign up -> onboarded -> discover -> join/host)
 *  and confirm people are actually using chat and account deletion. */
export type AnalyticsEvent =
  | 'app_opened'
  | 'sign_up_started'
  | 'sign_up_completed'
  | 'onboarding_completed'
  | 'activity_viewed'
  | 'activity_joined'
  | 'activity_created'
  | 'chat_message_sent'
  | 'account_deleted';

/** Fire-and-forget: analytics must never block or crash a user-facing
 *  action. Failures are swallowed silently (a missing session, an offline
 *  device, or an RLS mismatch shouldn't surface anywhere in the UI). */
export function track(event: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}): void {
  supabase.auth
    .getSession()
    .then(({ data }) =>
      supabase.from('analytics_events').insert({
        user_id: data.session?.user.id ?? null,
        event_name: event,
        properties,
      }),
    )
    .then((result) => {
      if (result && 'error' in result && result.error) {
        console.log('[Analytics] insert failed', event, result.error.message);
      }
    })
    .catch(() => {
      // Never let analytics failures surface anywhere in the UI.
    });
}
