export type ParsedRecoveryLink =
  | { status: 'ok'; accessToken: string; refreshToken: string }
  | { status: 'expired' }
  | { status: 'malformed' }
  | { status: 'not_recovery' };

/** Parses an incoming `nestup://reset-password#access_token=...` (or
 *  `?access_token=...`) deep link. Supabase puts the recovery tokens in the
 *  URL fragment for the implicit flow, or reports failure via
 *  `error`/`error_code` params (e.g. `otp_expired` for a used/expired link) —
 *  both forms are handled here so the caller never has to touch a raw token
 *  string itself. Never logs the URL or any parsed token. */
export function parseRecoveryUrl(url: string): ParsedRecoveryLink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'malformed' };
  }
  if (!parsed.pathname.includes('reset-password') && parsed.host !== 'reset-password') {
    return { status: 'not_recovery' };
  }

  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const params = new URLSearchParams(fragment || parsed.search);

  const errorCode = params.get('error_code') ?? params.get('error');
  if (errorCode) {
    return errorCode === 'otp_expired' || errorCode === 'access_denied' ? { status: 'expired' } : { status: 'malformed' };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (!accessToken || !refreshToken) return { status: 'malformed' };
  if (type && type !== 'recovery') return { status: 'not_recovery' };
  return { status: 'ok', accessToken, refreshToken };
}
