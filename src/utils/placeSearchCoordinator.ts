import type { NormalizedPlace } from '@/types/place';
import type {
  PlaceSearchErrorCode,
  PlaceSearchRequest,
  PlaceSearchResult,
  PlaceSuggestion,
} from '@/lib/placeSearchClient';
import { currentAppLocale, translate } from '@/i18n/core';

export type PlaceSearchStatus =
  | 'idle'
  | 'loading'
  | 'results'
  | 'empty'
  | 'timeout'
  | 'rate_limited'
  | 'configuration_missing'
  | 'unauthorized'
  | 'unavailable';

export type PlaceSearchItem =
  | { kind: 'suggestion'; key: string; suggestion: PlaceSuggestion }
  | { kind: 'place'; key: string; place: NormalizedPlace };

export interface PlaceSearchState {
  query: string;
  results: PlaceSearchItem[];
  status: PlaceSearchStatus;
  errorMessage: string | null;
}

export interface PlaceSearchInvoker {
  (request: PlaceSearchRequest): Promise<PlaceSearchResult>;
}

export interface PlaceSearchScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

const DEFAULT_SCHEDULER: PlaceSearchScheduler = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};

export const PLACE_SEARCH_DEBOUNCE_MS = 350;
export const PLACE_SEARCH_MIN_QUERY_LENGTH = 2;
export const PLACE_SEARCH_MAX_RESULTS = 8;

export class PlaceSearchCoordinator {
  private state: PlaceSearchState = { query: '', results: [], status: 'idle', errorMessage: null };
  private listeners = new Set<(state: PlaceSearchState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private version = 0;
  private lastRequestKey: string | null = null;
  private lastCenter = { latitude: 0, longitude: 0 };
  private readonly invoke: PlaceSearchInvoker;
  private readonly scheduler: PlaceSearchScheduler;

  constructor(invoke: PlaceSearchInvoker, scheduler = DEFAULT_SCHEDULER) {
    this.invoke = invoke;
    this.scheduler = scheduler;
  }

  subscribe(listener: (state: PlaceSearchState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setQuery(query: string, center: { latitude: number; longitude: number }): void {
    this.lastCenter = center;
    this.patch({ query });
    if (this.timer) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
    const trimmed = query.trim();
    if (trimmed.length < PLACE_SEARCH_MIN_QUERY_LENGTH) {
      this.version += 1;
      this.lastRequestKey = null;
      this.patch({ results: [], status: 'idle', errorMessage: null });
      return;
    }
    const key = placeSearchRequestKey(trimmed, center);
    if (key === this.lastRequestKey) return;
    this.timer = this.scheduler.setTimeout(() => void this.search(trimmed, center, key), PLACE_SEARCH_DEBOUNCE_MS);
  }

  retry(): void {
    this.lastRequestKey = null;
    this.setQuery(this.state.query, this.lastCenter);
  }

  clear(): void {
    if (this.timer) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
    this.version += 1;
    this.lastRequestKey = null;
    this.state = { query: '', results: [], status: 'idle', errorMessage: null };
    this.emit();
  }

  clearResults(): void {
    this.version += 1;
    this.patch({ results: [], status: 'idle', errorMessage: null });
  }

  async resolve(item: PlaceSearchItem): Promise<NormalizedPlace> {
    if (item.kind === 'place') return item.place;
    try {
      const result = await this.invoke({ action: 'place_details', completionToken: item.suggestion.resolutionToken, language: languageForQuery(this.state.query), countryCode: 'IL', center: this.lastCenter, limit: PLACE_SEARCH_MAX_RESULTS });
      if (result.kind !== 'places' || !result.places[0]) throw createCoordinatorError('MALFORMED_PROVIDER_RESPONSE');
      return result.places[0];
    } catch (error) {
      const mapped = statusForPlaceSearchError(readErrorCode(error));
      this.patch({ status: mapped.status, errorMessage: mapped.message });
      throw error;
    }
  }

  dispose(): void {
    if (this.timer) this.scheduler.clearTimeout(this.timer);
    this.listeners.clear();
    this.version += 1;
  }

  private async search(query: string, center: { latitude: number; longitude: number }, key: string): Promise<void> {
    this.timer = null;
    this.lastRequestKey = key;
    const version = ++this.version;
    this.patch({ status: 'loading', errorMessage: null });
    try {
      const response = await this.invoke({ action: 'autocomplete', query, language: languageForQuery(query), countryCode: 'IL', center, limit: PLACE_SEARCH_MAX_RESULTS });
      if (version !== this.version) return;
      const results = dedupePlaceSearchResults(response).slice(0, PLACE_SEARCH_MAX_RESULTS);
      this.patch({ results, status: results.length ? 'results' : 'empty', errorMessage: null });
    } catch (error) {
      if (version !== this.version) return;
      const code = readErrorCode(error);
      const mapped = statusForPlaceSearchError(code);
      this.patch({ results: [], status: mapped.status, errorMessage: mapped.message });
    }
  }

  private patch(change: Partial<PlaceSearchState>): void {
    this.state = { ...this.state, ...change };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

export function languageForQuery(query: string): 'en' | 'he' {
  return /[\u0590-\u05ff]/.test(query) ? 'he' : 'en';
}

export function placeSearchRequestKey(query: string, center: { latitude: number; longitude: number }): string {
  return `${query.trim().toLocaleLowerCase()}|${center.latitude.toFixed(4)},${center.longitude.toFixed(4)}`;
}

export function dedupePlaceSearchResults(response: PlaceSearchResult): PlaceSearchItem[] {
  const seen = new Set<string>();
  if (response.kind === 'suggestions') {
    return response.suggestions.flatMap((suggestion) => {
      const key = `suggestion:${suggestion.resolutionToken}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ kind: 'suggestion' as const, key, suggestion }];
    });
  }
  if (response.kind !== 'places') return [];
  return response.places.flatMap((place) => {
    const identity = place.providerPlaceId ?? `${place.latitude},${place.longitude},${place.name}`;
    const key = `place:${identity}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind: 'place' as const, key, place }];
  });
}

export function statusForPlaceSearchError(code: PlaceSearchErrorCode | null): { status: PlaceSearchStatus; message: string } {
  const locale = currentAppLocale();
  switch (code) {
    case 'TIMEOUT': return { status: 'timeout', message: translate(locale, 'locationPicker.error.timeout') };
    case 'RATE_LIMITED': return { status: 'rate_limited', message: translate(locale, 'locationPicker.error.rateLimited') };
    case 'CONFIGURATION_MISSING': return { status: 'configuration_missing', message: translate(locale, 'locationPicker.error.configuration') };
    case 'UNAUTHORIZED': return { status: 'unauthorized', message: translate(locale, 'locationPicker.error.unauthorized') };
    default: return { status: 'unavailable', message: translate(locale, 'locationPicker.error.unavailable') };
  }
}

function readErrorCode(error: unknown): PlaceSearchErrorCode | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code as PlaceSearchErrorCode : null;
}

function createCoordinatorError(code: PlaceSearchErrorCode): Error & { code: PlaceSearchErrorCode } {
  return Object.assign(new Error('Place details could not be resolved.'), { code });
}
