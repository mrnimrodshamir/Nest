export type AnalyticsEvent =
  | 'app_opened' | 'onboarding_started' | 'onboarding_completed'
  | 'login_started' | 'login_completed' | 'language_changed'
  | 'discovery_opened' | 'discovery_search_used' | 'discovery_filter_changed'
  | 'discovery_sort_changed' | 'discovery_item_opened'
  | 'activity_opened' | 'activity_created' | 'activity_joined' | 'activity_left' | 'activity_shared'
  | 'event_opened' | 'event_rsvp_joined' | 'event_rsvp_left' | 'event_shared'
  | 'place_opened' | 'place_shared'
  | 'chats_opened' | 'forum_opened' | 'forum_joined' | 'forum_message_sent'
  | 'public_profile_opened' | 'profile_updated'
  | 'share_started' | 'share_completed' | 'share_cancelled' | 'share_failed'
  | 'screen_viewed' | 'user_identified'
  | 'sign_up_started' | 'sign_up_completed' | 'activity_viewed'
  | 'chat_message_sent' | 'account_deleted'
  | 'daily_push_opened' | 'daily_digest_viewed' | 'daily_digest_event_opened' | 'daily_digest_closed' | 'daily_digest_rsvp_after_open';

export type AnalyticsValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsValue | null | undefined>;
export type AnalyticsContext = AnalyticsProperties;
export interface AnalyticsPayload { eventName: AnalyticsEvent; properties: Record<string, AnalyticsValue> }
export interface AnalyticsTransport { send(payload: AnalyticsPayload): Promise<void> }

const PRIVATE_PROPERTY = /(?:email|phone|birth|dob|child(?:ren)?_?name|message(?:_?content)?|bio|latitude|longitude|coordinates?|address|token|secret|password)/i;
const MAX_PROPERTIES = 20;
const MAX_STRING_LENGTH = 120;

/** A privacy-safe identifier for one app-process session. It contains no
 * device, account or installation identifier, but lets anonymous onboarding
 * events be joined to later authenticated events from the same launch. */
export function createAnalyticsSessionId(now = Date.now(), random = Math.random()): string {
  return `session_${now.toString(36)}_${Math.floor(random * 0x100000000).toString(36).padStart(7, '0')}`;
}

export function sanitizeAnalyticsProperties(input: AnalyticsProperties = {}): Record<string, AnalyticsValue> {
  const output: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(output).length >= MAX_PROPERTIES) break;
    if (!/^[a-z][a-z0-9_]{0,47}$/i.test(key) || PRIVATE_PROPERTY.test(key)) continue;
    if (typeof value === 'string') output[key] = value.slice(0, MAX_STRING_LENGTH);
    else if (typeof value === 'boolean') output[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
  }
  return output;
}

export function createAnalytics(transport: AnalyticsTransport) {
  let context: Record<string, AnalyticsValue> = {};
  const trackEvent = (eventName: AnalyticsEvent, properties: AnalyticsProperties = {}): void => {
    const payload = { eventName, properties: sanitizeAnalyticsProperties({ ...context, ...properties }) };
    Promise.resolve().then(() => transport.send(payload)).catch(() => undefined);
  };
  return {
    track: trackEvent,
    setContext(properties: AnalyticsContext = {}): void {
      context = sanitizeAnalyticsProperties({ ...context, ...properties });
    },
    identify(properties: AnalyticsProperties = {}): void { trackEvent('user_identified', properties); },
    screen(screenName: string, properties: AnalyticsProperties = {}): void {
      trackEvent('screen_viewed', { ...properties, screen_name: screenName });
    },
  };
}
