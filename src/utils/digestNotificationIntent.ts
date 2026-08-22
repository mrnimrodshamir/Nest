import { parseDigestNotification } from './dailyDigestNotification';

export type PendingDigestIntent =
  | { kind: 'daily'; date: string; occurrenceIds: string[] }
  | { kind: 'weekly'; weekStart: string; occurrenceIds: string[] }
  | { kind: 'weekend'; weekendStart: string; occurrenceIds: string[] }
  | { kind: 'fallback' };

export type DigestCaptureResult = 'queued' | 'duplicate' | 'not_digest';

/**
 * Process-local notification intent ledger. Notification responses can arrive
 * through both Expo's cold-start lookup and its warm listener; this owns the
 * single pending intent and refuses to enqueue the same native request twice.
 * The intent is deliberately consumed only after the main stack has confirmed
 * that Digest routes are registered and navigation was dispatched.
 */
export class DigestNotificationIntentController {
  private pending: PendingDigestIntent | null = null;
  private handledIds = new Set<string>();
  private handledOrder: string[] = [];

  capture(
    data: Record<string, unknown> | undefined,
    notificationId?: string,
    now: Date = new Date(),
  ): DigestCaptureResult {
    if (notificationId && this.handledIds.has(notificationId)) return 'duplicate';

    const route = parseDigestNotification(data, now);
    if (route.status === 'not_digest') return 'not_digest';
    if (notificationId) this.remember(notificationId);

    this.pending = route.status !== 'valid'
      ? { kind: 'fallback' }
      : route.digestType === 'weekly'
        ? { kind: 'weekly', weekStart: route.weekStart, occurrenceIds: route.occurrenceIds }
        : route.digestType === 'weekend'
          ? { kind: 'weekend', weekendStart: route.weekendStart, occurrenceIds: route.occurrenceIds }
        : { kind: 'daily', date: route.date, occurrenceIds: route.occurrenceIds };
    return 'queued';
  }

  peek(): PendingDigestIntent | null {
    return this.pending;
  }

  consume(intent: PendingDigestIntent): boolean {
    if (this.pending !== intent) return false;
    this.pending = null;
    return true;
  }

  private remember(notificationId: string): void {
    this.handledIds.add(notificationId);
    this.handledOrder.push(notificationId);
    if (this.handledOrder.length <= 32) return;
    const expired = this.handledOrder.shift();
    if (expired) this.handledIds.delete(expired);
  }
}

export function digestRoutesAreRegistered(routeNames: readonly string[] | undefined): boolean {
  return !!routeNames?.includes('DailyDigest') && routeNames.includes('WeeklyDigest') && routeNames.includes('WeekendDigest');
}
