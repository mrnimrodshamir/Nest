import { buildWhatsAppUrl } from '@/utils/contentSharing';

export interface ShareDependencies {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
  share: (payload: { message: string }) => Promise<unknown>;
  dismissedAction?: string;
}

export interface ShareAnalyticsContext {
  contentType: 'activity' | 'event' | 'place';
  contentId: string;
}

type ShareEvent = 'share_started' | 'share_completed' | 'share_cancelled' | 'share_failed' | 'activity_shared' | 'event_shared' | 'place_shared';
type ShareTracker = (event: ShareEvent, properties: Record<string, string>) => void;

let nativeDependencies: ShareDependencies | null = null;
let analyticsTracker: ShareTracker = () => undefined;

/** Configured once from the app's statically imported native adapter. */
export function configureShareRuntime(dependencies: ShareDependencies, tracker: ShareTracker): void {
  nativeDependencies = dependencies;
  analyticsTracker = tracker;
}

/** Resolves React Native's Linking/Share. The methods must stay wrapped: passing
 * them by reference detaches their native receiver and caused the device crash
 * this helper exists to prevent. */
function resolveDependencies(dependencies?: ShareDependencies): ShareDependencies {
  if (dependencies) return dependencies;
  if (!nativeDependencies) throw new Error('Share runtime unavailable');
  return nativeDependencies;
}

/** One process-wide lock covers both WhatsApp and native presentation. A fast
 * double tap must not launch WhatsApp twice or present two share sheets. */
let inFlight = false;

export type NativeShareResult = 'opened' | 'dismissed' | 'failed' | 'unavailable';
export type WhatsAppShareResult = 'whatsapp' | 'native' | 'dismissed' | 'failed' | 'unavailable';

function shareProperties(context: ShareAnalyticsContext | undefined, channel: 'whatsapp' | 'native') {
  return {
    share_channel: channel,
    ...(context ? { content_type: context.contentType, content_id: context.contentId } : {}),
  };
}

function trackShare(event: ShareEvent, properties: Record<string, string>): void {
  // The analytics transport is already fire-and-forget. Keep this guard so a
  // future instrumentation change still cannot break the product action.
  try { analyticsTracker(event, properties); } catch { /* fire-and-forget */ }
}

function trackOutcome(
  result: NativeShareResult,
  channel: 'whatsapp' | 'native',
  context?: ShareAnalyticsContext,
): void {
  if (!context) return;
  const properties = shareProperties(context, channel);
  if (result === 'opened') {
    trackShare('share_completed', properties);
    trackShare(`${context.contentType}_shared`, properties);
  } else if (result === 'dismissed') trackShare('share_cancelled', properties);
  else trackShare('share_failed', properties);
}

function looksLikeCancellation(error: unknown): boolean {
  return /cancel|dismiss/i.test(error instanceof Error ? error.message : String(error));
}

async function performNativeShare(message: string, resolved: ShareDependencies): Promise<NativeShareResult> {
  try {
    const response = await resolved.share({ message });
    const action = response && typeof response === 'object' && 'action' in response
      ? String((response as { action?: unknown }).action ?? '')
      : '';
    return resolved.dismissedAction && action === resolved.dismissedAction ? 'dismissed' : 'opened';
  } catch (error) {
    return looksLikeCancellation(error) ? 'dismissed' : 'failed';
  }
}

/** Opens the native share sheet and never rejects. */
export async function openNativeShare(
  message: string,
  dependencies?: ShareDependencies,
  context?: ShareAnalyticsContext,
): Promise<NativeShareResult> {
  if (!message?.trim()) return 'unavailable';
  if (context) trackShare('share_started', shareProperties(context, 'native'));
  if (inFlight) {
    trackOutcome('dismissed', 'native', context);
    return 'dismissed';
  }
  inFlight = true;
  try {
    let resolved: ShareDependencies;
    try {
      resolved = resolveDependencies(dependencies);
    } catch {
      trackOutcome('unavailable', 'native', context);
      return 'unavailable';
    }
    const result = await performNativeShare(message, resolved);
    trackOutcome(result, 'native', context);
    return result;
  } finally {
    inFlight = false;
  }
}

/** Opens WhatsApp for general content sharing, then falls back to the native
 * sheet. It never addresses a recipient and never rejects. */
export async function openWhatsAppShare(
  message: string,
  dependencies?: ShareDependencies,
  context?: ShareAnalyticsContext,
): Promise<WhatsAppShareResult> {
  if (!message?.trim()) return 'unavailable';
  if (context) trackShare('share_started', shareProperties(context, 'whatsapp'));
  if (inFlight) {
    trackOutcome('dismissed', 'whatsapp', context);
    return 'dismissed';
  }
  inFlight = true;
  try {
    let resolved: ShareDependencies;
    try {
      resolved = resolveDependencies(dependencies);
    } catch {
      trackOutcome('unavailable', 'whatsapp', context);
      return 'unavailable';
    }

    try {
      const url = buildWhatsAppUrl(message);
      if (await resolved.canOpenURL(url)) {
        await resolved.openURL(url);
        trackOutcome('opened', 'whatsapp', context);
        return 'whatsapp';
      }
    } catch {
      // WhatsApp failures deliberately fall through to the native sheet.
    }

    const nativeResult = await performNativeShare(message, resolved);
    trackOutcome(nativeResult, 'native', context);
    if (nativeResult === 'opened') return 'native';
    return nativeResult;
  } finally {
    inFlight = false;
  }
}

/** Test-only: clears the presentation guard between cases. */
export function __resetShareGuard(): void {
  inFlight = false;
}
