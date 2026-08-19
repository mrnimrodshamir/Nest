import type { PlaceSearchRequest, SupportedLanguage } from './contract.ts';
import { PlaceFunctionError } from './errors.ts';

const ACTIONS = new Set(['autocomplete', 'search', 'place_details', 'reverse_geocode']);
const LANGUAGES = new Set<SupportedLanguage>(['en', 'he', 'fr', 'ru']);

export interface ValidatedRequest {
  action: 'autocomplete' | 'search' | 'place_details' | 'reverse_geocode';
  query: string;
  language: SupportedLanguage;
  countryCode: string;
  center?: { latitude: number; longitude: number };
  limit: number;
  completionToken?: string;
}

export function validateRequest(value: unknown): ValidatedRequest {
  if (!value || typeof value !== 'object') invalid();
  const request = value as PlaceSearchRequest;
  if (!ACTIONS.has(request.action)) invalid('Unsupported action.');

  const language = request.language ?? 'en';
  if (!LANGUAGES.has(language)) invalid('Unsupported language.');
  const countryCode = (request.countryCode ?? 'IL').toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) invalid('Invalid country code.');
  const limit = request.limit ?? 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) invalid('Limit must be between 1 and 8.');

  if (request.center) {
    const { latitude, longitude } = request.center;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      invalid('Invalid map center.');
    }
  }

  if (request.action === 'place_details') {
    if (typeof request.completionToken !== 'string' || request.completionToken.length < 1 || request.completionToken.length > 4096) {
      invalid('A completion token is required.');
    }
    return { action: request.action, query: '', language, countryCode, center: request.center, limit, completionToken: request.completionToken };
  }

  if (request.action === 'reverse_geocode') {
    if (!request.center) invalid('A coordinate is required to reverse-geocode.');
    return { action: request.action, query: '', language, countryCode, center: request.center, limit };
  }

  const query = typeof request.query === 'string' ? request.query.trim() : '';
  if (query.length < 2 || query.length > 100) invalid('Query must be between 2 and 100 characters.');
  return { action: request.action, query, language, countryCode, center: request.center, limit };
}

function invalid(message = 'Invalid request.'): never {
  throw new PlaceFunctionError('INVALID_REQUEST', message, 400);
}

