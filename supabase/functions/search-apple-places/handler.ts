import type { PlaceSearchResponse } from './contract.ts';
import { PlaceFunctionError, safeErrorResponse } from './errors.ts';
import { validateRequest } from './validation.ts';

export interface HandlerDependencies {
  authenticate: (authorizationHeader: string | null) => Promise<boolean>;
  consumeRateLimit: (authorizationHeader: string) => Promise<boolean>;
  executeAppleRequest: (request: ReturnType<typeof validateRequest>) => Promise<PlaceSearchResponse>;
}

export async function handlePlaceRequest(request: Request, dependencies: HandlerDependencies): Promise<Response> {
  try {
    if (request.method !== 'POST') throw new PlaceFunctionError('INVALID_REQUEST', 'POST is required.', 405);
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ') || !(await dependencies.authenticate(authorization))) {
      throw new PlaceFunctionError('UNAUTHORIZED', 'Authentication is required.', 401);
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new PlaceFunctionError('INVALID_REQUEST', 'Invalid JSON body.', 400); }
    const validated = validateRequest(body);
    if (!(await dependencies.consumeRateLimit(authorization))) {
      throw new PlaceFunctionError('RATE_LIMITED', 'Too many place searches. Please try again shortly.', 429);
    }
    const response = await dependencies.executeAppleRequest(validated);
    return json(response, 200);
  } catch (error) {
    const safe = safeErrorResponse(error);
    return json(safe.body, safe.status);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

