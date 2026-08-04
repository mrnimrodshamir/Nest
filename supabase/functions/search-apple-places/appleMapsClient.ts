import type { PlaceSearchResponse } from './contract.ts';
import type { ValidatedRequest } from './validation.ts';
import { adaptAutocompleteResponse, adaptPlacesResponse } from './appleAdapter.ts';
import { decodeCompletionToken } from './completionToken.ts';
import { PlaceFunctionError } from './errors.ts';
import type { AppleMapsTokenService } from './tokenService.ts';

const APPLE_ORIGIN = 'https://maps-api.apple.com';

export class AppleMapsClient {
  private readonly tokens: Pick<AppleMapsTokenService, 'getAccessToken'>;
  private readonly fetchImplementation: typeof fetch;

  constructor(
    tokens: Pick<AppleMapsTokenService, 'getAccessToken'>,
    fetchImplementation: typeof fetch = fetch,
  ) {
    this.tokens = tokens;
    this.fetchImplementation = fetchImplementation;
  }

  async execute(request: ValidatedRequest): Promise<PlaceSearchResponse> {
    const url = this.buildUrl(request);
    const accessToken = await this.tokens.getAccessToken();
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new PlaceFunctionError('TIMEOUT', 'The place provider timed out.', 504);
      }
      throw new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
    }

    if (response.status === 429) throw new PlaceFunctionError('RATE_LIMITED', 'Place search is temporarily rate limited.', 429);
    if (response.status === 401) throw new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
    if (!response.ok) throw new PlaceFunctionError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new PlaceFunctionError('MALFORMED_PROVIDER_RESPONSE', 'The place provider returned an invalid response.', 502); }

    if (request.action === 'autocomplete') {
      return { kind: 'suggestions', suggestions: adaptAutocompleteResponse(payload, request.limit) };
    }
    return { kind: 'places', places: adaptPlacesResponse(payload, request.limit) };
  }

  private buildUrl(request: ValidatedRequest): URL {
    if (request.action === 'place_details') return decodeCompletionToken(request.completionToken!);
    const endpoint = request.action === 'autocomplete' ? '/v1/searchAutocomplete' : '/v1/search';
    const url = new URL(endpoint, APPLE_ORIGIN);
    url.searchParams.set('q', request.query);
    url.searchParams.set('lang', request.language === 'he' ? 'he-IL' : 'en-US');
    url.searchParams.set('limitToCountries', request.countryCode);
    if (request.center) url.searchParams.set('searchLocation', `${request.center.latitude},${request.center.longitude}`);
    return url;
  }
}
