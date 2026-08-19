import type { NormalizedPlaceResponse, PlaceSuggestionResponse, ReverseGeocodeResponse } from './contract.ts';
import { encodeCompletionToken } from './completionToken.ts';
import { PlaceFunctionError } from './errors.ts';

type UnknownRecord = Record<string, unknown>;

export function adaptAutocompleteResponse(payload: unknown, limit: number): PlaceSuggestionResponse[] {
  const results = record(payload)?.results;
  if (!Array.isArray(results)) malformed();
  const seen = new Set<string>();
  const suggestions: PlaceSuggestionResponse[] = [];
  for (const raw of results) {
    const item = record(raw);
    if (!item || typeof item.completionUrl !== 'string') continue;
    const lines = Array.isArray(item.displayLines) ? item.displayLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0) : [];
    if (!lines[0]) continue;
    const resolutionToken = encodeCompletionToken(item.completionUrl);
    if (seen.has(resolutionToken)) continue;
    seen.add(resolutionToken);
    suggestions.push({ name: lines[0].trim(), formattedAddress: lines.slice(1).join(', ') || null, category: text(item.resultType), resolutionToken });
    if (suggestions.length === limit) break;
  }
  return suggestions;
}

export function adaptPlacesResponse(payload: unknown, limit: number): NormalizedPlaceResponse[] {
  const root = record(payload);
  const rawResults = root?.results ?? root?.places;
  if (!Array.isArray(rawResults)) malformed();
  const seen = new Set<string>();
  const places: NormalizedPlaceResponse[] = [];
  for (const raw of rawResults) {
    const item = record(raw);
    if (!item) continue;
    const coordinate = record(item.coordinate);
    const latitude = coordinate?.latitude;
    const longitude = coordinate?.longitude;
    const name = text(item.name) ?? text(item.displayName);
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    const providerPlaceId = text(item.id) ?? text(item.placeId);
    const key = providerPlaceId ?? `${latitude},${longitude},${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const addressLines = Array.isArray(item.formattedAddressLines) ? item.formattedAddressLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0) : [];
    places.push({
      name,
      formattedAddress: addressLines.join(', ') || text(item.formattedAddress) || null,
      latitude,
      longitude,
      category: text(item.poiCategory) ?? text(item.category),
      provider: 'apple_maps',
      providerPlaceId,
      source: 'provider',
      wasAdjusted: false,
    });
    if (places.length === limit) break;
  }
  return places;
}

/** Apple's own `formattedAddressLines` is the canonical, already-deduplicated
 *  address for a coordinate — it never repeats the street name the way naively
 *  concatenating separate `name`/`street`/`locality` fields can. We deliberately
 *  do not reassemble the address from individual components ourselves: that is
 *  exactly the class of bug this adapter exists to avoid (see LocationPicker's
 *  on-device fallback, which has to do its own dedup precisely because
 *  expo-location doesn't give it one preassembled string like this). Returns
 *  null — never an invented/transliterated address — when Apple has nothing
 *  for this coordinate; the caller falls back to on-device geocoding. */
export function adaptReverseGeocodeResponse(payload: unknown): ReverseGeocodeResponse | null {
  const root = record(payload);
  const results = root?.results;
  if (!Array.isArray(results)) malformed();
  const first = record(results[0]);
  if (!first) return null;
  const coordinate = record(first.coordinate);
  const latitude = coordinate?.latitude;
  const longitude = coordinate?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  const lines = Array.isArray(first.formattedAddressLines)
    ? first.formattedAddressLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    : [];
  const formattedAddress = lines.join(', ') || text(first.name) || text(first.formattedAddress);
  if (!formattedAddress) return null;
  return { formattedAddress, latitude, longitude };
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function malformed(): never {
  throw new PlaceFunctionError('MALFORMED_PROVIDER_RESPONSE', 'The place provider returned an invalid response.', 502);
}

