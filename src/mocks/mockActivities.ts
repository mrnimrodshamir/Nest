import type { Activity, Attendee } from '@/types/activity';
import { FALLBACK_LOCATION } from '@/constants/location';

/** Realistic preview data for the Discovery screen — same `Activity` shape
 *  the real Supabase-backed hook returns, so every component downstream
 *  (ActivityCard, PersonCard, map pins) renders exactly as it would in
 *  production. Coordinates cluster around the Tel Aviv fallback so the map
 *  view has something to actually show. */

function attendee(id: string, displayName: string, avatarColor: string, avatarUrl: string | null = null): Attendee {
  return { id, displayName, avatarUrl, avatarColor };
}

const NOA = attendee('mock-noa', 'Noa Levi', '#C9A876');
const DANA = attendee('mock-dana', 'Dana Cohen', '#7C9A82');
const MICHAL = attendee('mock-michal', 'Michal Tal', '#8FB4C9');
const SHIRA = attendee('mock-shira', 'Shira Ben-David', '#A8A69C');
const YAEL = attendee('mock-yael', 'Yael Mizrahi', '#C9A876');

const now = new Date();
function hoursFromNow(hours: number): string {
  return new Date(now.getTime() + hours * 3600_000).toISOString();
}

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'mock-1',
    hostId: 'mock-noa',
    title: 'Morning stroller loop',
    category: 'stroller_walk',
    coverImageUrl: null,
    status: 'published',
    startTime: hoursFromNow(15),
    durationMinutes: 60,
    distanceKm: 0.6,
    latitude: FALLBACK_LOCATION.latitude + 0.004,
    longitude: FALLBACK_LOCATION.longitude + 0.003,
    attendees: [NOA, DANA, MICHAL],
    attendeeCount: 6,
    capacity: 8,
    babyMinAgeMonths: 0,
    babyMaxAgeMonths: 24,
  },
  {
    id: 'mock-2',
    hostId: 'mock-dana',
    title: 'Coffee & catch-up at Cafe Nimrod',
    category: 'coffee_meetup',
    coverImageUrl: null,
    status: 'published',
    startTime: hoursFromNow(4),
    durationMinutes: 90,
    distanceKm: 1.2,
    latitude: FALLBACK_LOCATION.latitude - 0.006,
    longitude: FALLBACK_LOCATION.longitude + 0.008,
    attendees: [DANA],
    attendeeCount: 2,
    capacity: 6,
    babyMinAgeMonths: null,
    babyMaxAgeMonths: null,
  },
  {
    id: 'mock-3',
    hostId: 'mock-michal',
    title: 'Baby playtime — sensory hour',
    category: 'baby_playtime',
    coverImageUrl: null,
    status: 'full',
    startTime: hoursFromNow(28),
    durationMinutes: 45,
    distanceKm: 2.1,
    latitude: FALLBACK_LOCATION.latitude + 0.011,
    longitude: FALLBACK_LOCATION.longitude - 0.005,
    attendees: [MICHAL, SHIRA, YAEL, NOA, DANA],
    attendeeCount: 8,
    capacity: 8,
    babyMinAgeMonths: 6,
    babyMaxAgeMonths: 18,
  },
  {
    id: 'mock-4',
    hostId: 'mock-shira',
    title: 'Picnic at HaYarkon Park',
    category: 'picnic',
    coverImageUrl: null,
    status: 'published',
    startTime: hoursFromNow(52),
    durationMinutes: 120,
    distanceKm: 3.4,
    latitude: FALLBACK_LOCATION.latitude - 0.014,
    longitude: FALLBACK_LOCATION.longitude - 0.009,
    attendees: [SHIRA, YAEL],
    attendeeCount: 4,
    capacity: null,
    babyMinAgeMonths: 0,
    babyMaxAgeMonths: 36,
  },
  {
    id: 'mock-5',
    hostId: 'mock-yael',
    title: 'Postnatal fitness in the park',
    category: 'fitness',
    coverImageUrl: null,
    status: 'published',
    startTime: hoursFromNow(9),
    durationMinutes: 45,
    distanceKm: 1.8,
    latitude: FALLBACK_LOCATION.latitude + 0.007,
    longitude: FALLBACK_LOCATION.longitude + 0.012,
    attendees: [YAEL, NOA],
    attendeeCount: 3,
    capacity: 10,
    babyMinAgeMonths: null,
    babyMaxAgeMonths: null,
  },
  {
    id: 'mock-6',
    hostId: 'mock-noa',
    title: 'Gentle parent & baby yoga',
    category: 'yoga',
    coverImageUrl: null,
    status: 'cancelled',
    startTime: hoursFromNow(30),
    durationMinutes: 60,
    distanceKm: 2.6,
    latitude: FALLBACK_LOCATION.latitude - 0.003,
    longitude: FALLBACK_LOCATION.longitude + 0.015,
    attendees: [],
    attendeeCount: 0,
    capacity: 6,
    babyMinAgeMonths: 3,
    babyMaxAgeMonths: 12,
  },
];

export const MOCK_ACTIVITIES_EMPTY: Activity[] = [];
