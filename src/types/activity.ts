export type ActivityCategory =
  | 'walks'
  | 'coffee'
  | 'classes'
  | 'support'
  | 'playdates'
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
  distanceMiles: number;
  latitude: number;
  longitude: number;
  attendees: Attendee[];
  attendeeCount: number;
  capacity: number | null;
}

/** Pin color per category — reuses the same brand ramps as everywhere else,
 *  so the map reads as the same product as the feed, not a bolted-on view. */
export const CATEGORY_PIN_COLOR: Record<ActivityCategory, string> = {
  walks: '#7C9A82',
  playdates: '#7C9A82',
  coffee: '#C9A876',
  support: '#C9A876',
  classes: '#8FB4C9',
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
  viewerStatus: 'none' | 'going' | 'waitlisted';
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  walks: 'Walks',
  coffee: 'Coffee',
  classes: 'Classes',
  support: 'Support circles',
  playdates: 'Playdates',
  other: 'Other',
};
