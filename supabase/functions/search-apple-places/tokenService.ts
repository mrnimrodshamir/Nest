import { PlaceFunctionError } from './errors.ts';

export interface AppleTokenConfiguration {
  teamId: string;
  keyId: string;
  privateKey: string;
}

export interface TokenServiceDependencies {
  fetch: typeof fetch;
  now: () => number;
  crypto: Crypto;
}

interface CachedToken { value: string; expiresAtMs: number }

const TOKEN_ENDPOINT = 'https://maps-api.apple.com/v1/token';
const AUTH_TOKEN_LIFETIME_SECONDS = 300;
const REFRESH_MARGIN_MS = 60_000;

export class AppleMapsTokenService {
  private cached: CachedToken | null = null;
  private readonly configuration: AppleTokenConfiguration;
  private readonly dependencies: TokenServiceDependencies;

  constructor(
    configuration: AppleTokenConfiguration,
    dependencies: TokenServiceDependencies = { fetch, now: Date.now, crypto },
  ) {
    this.configuration = configuration;
    this.dependencies = dependencies;
  }

  async getAccessToken(): Promise<string> {
    const now = this.dependencies.now();
    if (this.cached && this.cached.expiresAtMs - REFRESH_MARGIN_MS > now) return this.cached.value;

    const authorizationToken = await this.createAuthorizationToken(now);
    let response: Response;
    try {
      response = await this.dependencies.fetch(TOKEN_ENDPOINT, {
        headers: { Authorization: `Bearer ${authorizationToken}` },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      if (isTimeout(error)) throw new PlaceFunctionError('TIMEOUT', 'The place provider timed out.', 504);
      throw new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
    }

    if (response.status === 429) throw new PlaceFunctionError('RATE_LIMITED', 'Place search is temporarily rate limited.', 429);
    if (response.status === 401) throw new PlaceFunctionError('CONFIGURATION_MISSING', 'Place search provider credentials are not accepted.', 503);
    if (!response.ok) throw new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);

    const payload = await safeJson(response);
    if (!payload || typeof payload.accessToken !== 'string' || !Number.isFinite(payload.expiresInSeconds) || payload.expiresInSeconds <= 0) {
      throw new PlaceFunctionError('MALFORMED_PROVIDER_RESPONSE', 'The place provider returned an invalid response.', 502);
    }
    this.cached = { value: payload.accessToken, expiresAtMs: now + payload.expiresInSeconds * 1_000 };
    return this.cached.value;
  }

  private async createAuthorizationToken(nowMs: number): Promise<string> {
    const { teamId, keyId, privateKey } = this.configuration;
    if (!teamId || !keyId || !privateKey) {
      throw new PlaceFunctionError('CONFIGURATION_MISSING', 'Place search is not configured.', 503);
    }
    const nowSeconds = Math.floor(nowMs / 1_000);
    const header = base64UrlJson({ alg: 'ES256', kid: keyId, typ: 'JWT' });
    const payload = base64UrlJson({ iss: teamId, iat: nowSeconds, exp: nowSeconds + AUTH_TOKEN_LIFETIME_SECONDS, scope: 'server_api' });
    const signingInput = `${header}.${payload}`;
    try {
      const key = await this.dependencies.crypto.subtle.importKey(
        'pkcs8',
        pemToBytes(privateKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      );
      const signature = await this.dependencies.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(signingInput),
      );
      return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
    } catch {
      throw new PlaceFunctionError('CONFIGURATION_MISSING', 'Place search is not configured.', 503);
    }
  }
}

export function readAppleTokenConfiguration(getEnv: (name: string) => string | undefined): AppleTokenConfiguration {
  const teamId = getEnv('APPLE_MAPS_TEAM_ID')?.trim() ?? '';
  const keyId = getEnv('APPLE_MAPS_KEY_ID')?.trim() ?? '';
  const privateKey = (getEnv('APPLE_MAPS_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n').trim();
  if (!teamId || !keyId || !privateKey) {
    throw new PlaceFunctionError('CONFIGURATION_MISSING', 'Place search is not configured.', 503);
  }
  return { teamId, keyId, privateKey };
}

function pemToBytes(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function safeJson(response: Response): Promise<Record<string, any> | null> {
  try { return await response.json(); } catch { return null; }
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
