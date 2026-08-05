/**
 * NestUp spacing & radius tokens
 *
 * Spacing follows a 4pt base grid (standard for iOS). Radius scale is
 * intentionally generous — soft, rounded corners are core to the "premium,
 * calm" brand feel, so we lean larger than a typical utility app.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radius = {
  sm: 8,    // inputs, chips, small controls
  md: 12,   // buttons, small cards
  lg: 16,   // standard cards
  xl: 24,   // hero cards, sheets, activity cover cards
  pill: 999, // avatars, tags, segmented controls
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
