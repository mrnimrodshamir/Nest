/**
 * Momzi color tokens
 *
 * Palette direction: "fresh & airy" — sage, sand, and soft sky blue on a warm
 * off-white base. Deliberately avoids pure white (#FFFFFF) and pure black —
 * both read as cold/clinical, which fights the "nurturing, calm" brand feel.
 *
 * Each brand hue has a light 50/100 tint (for chips, badges, soft
 * backgrounds), a 500 base (icons, accents), and a 700 strong (text on
 * tinted backgrounds, pressed states).
 */

export const colors = {
  // Brand — sage (primary actions, active states, the "Momzi green")
  sage: {
    50: '#F1F5F1',
    100: '#E4ECE5',
    200: '#C7D9CA',
    500: '#7C9A82',
    700: '#4F6B55',
    900: '#334536',
  },

  // Rose — warm blush/rose family (primary actions, checkbox, links,
  // decorative shapes). Only the 700 shade clears WCAG AA (4.5:1) against
  // white button text — 233/143/131 (500) and lighter only reach ~2.4:1,
  // so those stay reserved for tints, chips, and decorative surfaces,
  // never text-bearing buttons or link text.
  rose: {
    50: '#FDF3F5',
    100: '#F8DEE3',
    200: '#F3B6C2', // blush pink
    300: '#EFA3B3', // soft rose
    500: '#E98F83', // muted coral
    700: '#A95F70', // deep rose — buttons, checkboxes, active icons, links
    900: '#8B4E5D', // pressed state
  },

  // Secondary — warm sand (host/create actions, warm accents)
  sand: {
    50: '#FAF5EC',
    100: '#F1E4CE',
    200: '#E3D5C0',
    500: '#C9A876',
    700: '#96794F',
  },

  // Tertiary — soft sky blue (informational, chat accents)
  sky: {
    50: '#F1F7F9',
    100: '#E6EFF3',
    200: '#C7DEE6',
    500: '#8FB4C9',
    700: '#5C86A0',
  },

  // Neutrals — warm grays, never pure black/white
  neutral: {
    0: '#FEFDFB',     // surfaces (not pure white)
    50: '#FAF8F4',     // app background
    100: '#F1EFE8',
    200: '#E3E0D6',
    400: '#A8A69C',
    // 500 exists only for text.muted: at 400, muted text measures ~2.3:1
    // against the app background — well under WCAG AA's 4.5:1 floor for
    // small text, and text.muted is used for real content (chat sender
    // names, profile context, timestamps), not decoration. 500 measures
    // ~4.5:1. Kept separate from 400 so border.strong (which also uses
    // 400) is untouched.
    500: '#767368',
    600: '#726F65',
    800: '#3D3B36',
    900: '#2B2B28',     // primary text (not pure black)
  },

  // Semantic — soft, never alarming
  semantic: {
    success: '#7C9A82', // reuse sage, avoid a jarring green
    warning: '#E8B04B',
    warningTint: '#FBEFD7',
    danger: '#E2725B',
    dangerTint: '#F5DFDA',
    info: '#8FB4C9',    // reuse sky
  },

  // Fixed
  white: '#FFFFFF',
  black: '#000000',
} as const;

/**
 * Semantic aliases — components should reference these, not raw palette
 * values, so a future rebrand or dark-mode pass only touches this file.
 */
export const theme = {
  background: {
    app: colors.neutral[50],
    surface: colors.neutral[0],
    surfaceAlt: colors.sage[50],
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    muted: colors.neutral[500],
    inverse: colors.neutral[0],
    accent: colors.rose[700], // links, active text — deep rose
  },
  border: {
    default: colors.neutral[200],
    strong: colors.neutral[400],
  },
  brand: {
    // Primary CTA moved from sage to deep rose — warmer, more emotional,
    // more distinctly "Momzi" than the previous cream-and-sage identity.
    // Sage remains as a supporting color (semantic.success is already
    // sage-based and untouched by this change).
    primary: colors.rose[700],
    primaryPressed: colors.rose[900],
    primaryTint: colors.rose[100],
    secondary: colors.sand[500], // Host / create actions
    secondaryTint: colors.sand[100],
    accent: colors.sky[500],     // Chat / info accents
    accentTint: colors.sky[100],
    rose: colors.rose[500],      // muted coral — small highlights, icons
    roseBlush: colors.rose[200], // decorative surfaces, focus rings
    sage: colors.sage[500],      // supporting color — success, calm accents
  },
  semantic: colors.semantic,
} as const;

export type ThemeColors = typeof theme;
