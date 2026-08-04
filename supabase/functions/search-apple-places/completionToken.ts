import { PlaceFunctionError } from './errors.ts';

const APPLE_ORIGIN = 'https://maps-api.apple.com';

export function encodeCompletionToken(completionUrl: string): string {
  const url = validateAppleCompletionUrl(completionUrl);
  return encodeBase64Url(new TextEncoder().encode(`${url.pathname}${url.search}`));
}

export function decodeCompletionToken(token: string): URL {
  try {
    const path = new TextDecoder().decode(decodeBase64Url(token));
    return validateAppleCompletionUrl(path);
  } catch (error) {
    if (error instanceof PlaceFunctionError) throw error;
    throw new PlaceFunctionError('INVALID_REQUEST', 'Invalid completion token.', 400);
  }
}

export function validateAppleCompletionUrl(value: string): URL {
  const url = new URL(value, APPLE_ORIGIN);
  if (url.origin !== APPLE_ORIGIN || url.protocol !== 'https:' || url.username || url.password || !url.pathname.startsWith('/v1/search')) {
    throw new PlaceFunctionError('INVALID_REQUEST', 'Invalid completion URL.', 400);
  }
  return url;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

