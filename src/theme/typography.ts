/**
 * Monzy typography tokens
 *
 * Typeface: Plus Jakarta Sans — a geometric, modern-neutral sans (like
 * Instagram/Airbnb's custom faces) but warmer than Inter, which has become
 * the default look of every AI-generated / templated product. Distinctness
 * here matters: "no generic AI-generated layouts" starts with the font.
 *
 * Install (Expo):
 *   npx expo install @expo-google-fonts/plus-jakarta-sans expo-font
 *
 * Sizes roughly track iOS Human Interface Guidelines type scale so the
 * app feels native, while weight usage stays deliberately restrained —
 * two weights do almost everything (regular body, semibold emphasis).
 */

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 34, lineHeight: 40 },
  title1: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34 },
  title2: { fontFamily: fontFamily.semibold, fontSize: 22, lineHeight: 28 },
  title3: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 25 },
  headline: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 24 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 24 },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
} as const;

export type TypographyToken = keyof typeof typography;
