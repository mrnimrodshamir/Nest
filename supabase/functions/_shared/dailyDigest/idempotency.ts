/** One send key per user per calendar day. The real guarantee is a unique
 *  DB constraint on (user_id, digest_type, local_date) — this helper exists
 *  so callers (and their tests) build that key the exact same way instead of
 *  string-concatenating it ad hoc in three different places. A cron retry
 *  that reruns the same tick must produce the same key and hit the same
 *  constraint violation, not a fresh row. */
export const DIGEST_TYPE_DAILY = 'daily' as const;

export function buildDigestSendKey(userId: string, digestType: string, localDate: string): string {
  return `${userId}:${digestType}:${localDate}`;
}
