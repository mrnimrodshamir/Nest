export type ActivityCategory =
  | 'stroller_walk'
  | 'coffee_meetup'
  | 'baby_playtime'
  | 'playground_meetup'
  | 'picnic'
  | 'breakfast_meetup'
  | 'lunch_meetup'
  | 'beach'
  | 'indoor_playground'
  | 'story_time'
  | 'music_activity'
  | 'swimming'
  | 'fitness'
  | 'yoga'
  | 'workshop'
  | 'museum'
  | 'zoo'
  | 'shopping_together'
  | 'moms_night_out'
  | 'support_circle'
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

/** One curated illustration "family" per broad activity mood, reused
 *  across the specific categories that fit it — see
 *  src/components/CategoryArt.tsx. Twenty-one bespoke illustrations is
 *  more than this MVP pass can responsibly hand-author; grouping by mood
 *  keeps every category's default visual coherent and real (not emoji,
 *  not a placeholder) without pretending to a fidelity this pass doesn't
 *  have the tooling to produce. */
export type CategoryArtFamily = 'outdoors' | 'social' | 'active' | 'indoor';

export const CATEGORY_ART_FAMILY: Record<ActivityCategory, CategoryArtFamily> = {
  stroller_walk: 'outdoors',
  playground_meetup: 'outdoors',
  picnic: 'outdoors',
  beach: 'outdoors',
  zoo: 'outdoors',
  coffee_meetup: 'social',
  breakfast_meetup: 'social',
  lunch_meetup: 'social',
  shopping_together: 'social',
  moms_night_out: 'social',
  support_circle: 'social',
  fitness: 'active',
  yoga: 'active',
  swimming: 'active',
  baby_playtime: 'indoor',
  indoor_playground: 'indoor',
  story_time: 'indoor',
  music_activity: 'indoor',
  workshop: 'indoor',
  museum: 'indoor',
  other: 'social',
};

/** One distinct color per category so the map is scannable at a glance —
 *  each drawn from a calm, muted, brand-consistent palette (no neon,
 *  no loud saturation). */
export const CATEGORY_PIN_COLOR: Record<ActivityCategory, string> = {
  stroller_walk: '#7C9A82', // sage — brand primary
  playground_meetup: '#8FAE87',
  picnic: '#9CAA5C', // moss green
  beach: '#6FB8C7',
  zoo: '#7FA86B',
  coffee_meetup: '#C9A876', // sand — brand secondary
  breakfast_meetup: '#D9B98A',
  lunch_meetup: '#CBA0A0',
  shopping_together: '#B695C0', // muted plum
  moms_night_out: '#A876B0',
  support_circle: '#D98C9E',
  fitness: '#6FA8A0', // teal
  yoga: '#9CA8D6', // soft periwinkle
  swimming: '#5FA6C9',
  baby_playtime: '#D98C72', // warm terracotta
  indoor_playground: '#E0A97E',
  story_time: '#C9976E',
  music_activity: '#B0879E',
  workshop: '#B695C0',
  museum: '#8E97B0',
  other: '#A8A69C', // neutral
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
  playground_meetup: 'Playground meetup',
  picnic: 'Picnic',
  breakfast_meetup: 'Breakfast meetup',
  lunch_meetup: 'Lunch meetup',
  beach: 'Beach',
  indoor_playground: 'Indoor playground',
  story_time: 'Story time',
  music_activity: 'Music activity',
  swimming: 'Swimming',
  fitness: 'Fitness',
  yoga: 'Yoga',
  workshop: 'Workshop',
  museum: 'Museum',
  zoo: 'Zoo',
  shopping_together: 'Shopping together',
  moms_night_out: "Moms' night out",
  support_circle: 'Support circle',
  other: 'Other',
};

export const DURATION_OPTIONS_MINUTES = [30, 45, 60, 90, 120] as const;
