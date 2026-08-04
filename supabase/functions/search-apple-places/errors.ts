import type { PlaceErrorCode } from './contract.ts';

export class PlaceFunctionError extends Error {
  readonly code: PlaceErrorCode;
  readonly status: number;

  constructor(code: PlaceErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'PlaceFunctionError';
  }
}

export function safeErrorResponse(error: unknown): { status: number; body: { error: { code: PlaceErrorCode; message: string } } } {
  const safe = error instanceof PlaceFunctionError
    ? error
    : new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
  return { status: safe.status, body: { error: { code: safe.code, message: safe.message } } };
}
