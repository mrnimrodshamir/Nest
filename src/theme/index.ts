/**
 * Monzy design system — single entry point
 *
 * Import from '@/theme' throughout the app rather than reaching into
 * individual token files, so screens stay decoupled from token structure.
 *
 *   import { theme, typography, spacing, radius, springs } from '@/theme';
 */

export { colors, theme } from './colors';
export { fontFamily, typography } from './typography';
export type { TypographyToken } from './typography';
export { spacing, radius } from './spacing';
export type { SpacingToken, RadiusToken } from './spacing';
export { springs, durations, pressFeedback, listStagger } from './motion';

/**
 * Icons: Phosphor Icons (regular weight, 1.5px stroke) — soft, rounded
 * terminals that match the rest of the brand better than sharp/technical
 * sets like Feather or Ionicons.
 *
 *   npx expo install phosphor-react-native react-native-svg
 *   import { House, ChatCircle, UserCircle, Plus } from 'phosphor-react-native';
 *
 * Default icon size: 24 (tab bar), 20 (inline), stroke weight: "regular".
 * Never mix weights ("bold" vs "regular") in the same screen.
 */
export const iconDefaults = {
  size: { inline: 20, tabBar: 24 },
  weight: 'regular' as const,
};
