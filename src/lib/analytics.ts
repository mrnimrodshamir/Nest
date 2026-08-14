import { supabase } from '@/lib/supabase';
import { createAnalytics, createAnalyticsSessionId, type AnalyticsTransport } from '@/lib/analyticsCore';
export * from '@/lib/analyticsCore';

const supabaseTransport: AnalyticsTransport = {
  async send({ eventName, properties }) {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    const { error } = await supabase.from('analytics_events').insert({
      // This identifier stays inside the same RLS-protected Supabase project.
      // It is never copied into properties or sent to an external vendor.
      user_id: userId,
      event_name: eventName,
      properties,
    });
    if (error) throw error;
  },
};

export const analytics = createAnalytics(supabaseTransport);
analytics.setContext({ session_id: createAnalyticsSessionId() });
export const track = analytics.track;
export const setAnalyticsContext = analytics.setContext;
export const identify = analytics.identify;
export const screen = analytics.screen;
