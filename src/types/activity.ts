export type ActivityCategory =
  | 'stroller_walk'
  | 'coffee_meetup'
  | 'baby_playtime'
  | 'picnic'
  | 'fitness'
  | 'yoga'
  | 'workshop'
  | 'other';

export interface Attendee {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string; // fallback flat color when no photo
}

export interface Activity {
  id: string;
  hostId: string;
  title: string;
  category: ActivityCategory;
  coverImageUrl: string | null;
  startTime: string; // ISO 8601
  durationMinutes: number;
  distanceMiles: number;
  latitude: number;
  longitude: number;
  attendees: Attendee[];
  attendeeCount: number;
  capacity: number | null;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
}

/** Pin color per category — reuses the same brand ramps as everywhere else,
 *  so the map reads as the same product as the feed, not a bolted-on view. */
export const CATEGORY_PIN_COLOR: Record<ActivityCategory, string> = {
  stroller_walk: '#7C9A82',
  baby_playtime: '#7C9A82',
  picnic: '#7C9A82',
  coffee_meetup: '#C9A876',
  workshop: '#C9A876',
  fitness: '#8FB4C9',
  yoga: '#8FB4C9',
  other: '#A8A69C',
};

export interface Host {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string;
  verified: boolean;
  bio: string | null;
}

export interface ActivityLocation {
  label: string; // e.g. "HaYarkon Park, main entrance" — always a public place
  latitude: number;
  longitude: number;
}

/** Full detail-screen shape. Extends the lightweight card Activity so the
 *  Discover feed never has to fetch description/host/location for every card. */
export interface ActivityDetail extends Activity {
  description: string;
  host: Host;
  location: ActivityLocation;
  notes: string | null;
  viewerStatus: 'none' | 'going' | 'waitlisted';
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  stroller_walk: 'Stroller walk',
  coffee_meetup: 'Coffee meetup',
  baby_playtime: 'Baby playtime',
  picnic: 'Picnic',
  fitness: 'Fitness',
  yoga: 'Yoga',
  workshop: 'Workshop',
  other: 'Other',
};

export const DURATION_OPTIONS_MINUTES = [30, 45, 60, 90, 120] as const;
