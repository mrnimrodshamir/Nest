export type ActivityCategory =
  | 'stroller_walk'
  | 'coffee_meetup'
  | 'baby_playtime'
  | 'picnic'
  | 'fitness'
  | 'yoga'
  | 'workshop'
  | 'other';

/** Draft is host-authoring-only and never shown in Discover. Full/Published
 *  toggle automatically based on capacity (see the DB trigger). No waitlist
 *  state in MVP — once full, joining is simply closed. */
export type ActivityStatus = 'draft' | 'published' | 'full' | 'cancelled' | 'completed';

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
  status: ActivityStatus;
  startTime: string; // ISO 8601
  durationMinutes: number;
  distanceKm: number;
  latitude: number;
  longitude: number;
  attendees: Attendee[];
  attendeeCount: number;
  capacity: number | null;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
}

/** One distinct color per category so the map is scannable at a glance —
 *  each still drawn from a calm, muted, brand-consistent palette (no neon,
 *  no loud saturation), not just the three core brand ramps repeated. */
export const CATEGORY_PIN_COLOR: Record<ActivityCategory, string> = {
  stroller_walk: '#7C9A82', // sage — brand primary
  coffee_meetup: '#C9A876', // sand — brand secondary
  baby_playtime: '#D98C72', // warm terracotta
  picnic: '#9CAA5C', // moss green
  fitness: '#6FA8A0', // teal
  yoga: '#9CA8D6', // soft periwinkle
  workshop: '#B695C0', // muted plum
  other: '#A8A69C', // neutral
};

export const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  stroller_walk: '🚶‍♀️',
  coffee_meetup: '☕',
  baby_playtime: '🧸',
  picnic: '🧺',
  fitness: '💪',
  yoga: '🧘‍♀️',
  workshop: '🎨',
  other: '✨',
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
  viewerStatus: 'none' | 'going';
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
