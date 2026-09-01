/**
 * Typography.
 *
 * Two families with distinct jobs, rather than one doing everything:
 *
 *   Space Grotesk — numbers and headings. Its digits have real character
 *     (a single-storey 'a', distinctive 1 and 7), which is what makes the
 *     money figures the memorable part of a screen instead of generic UI text.
 *   Manrope — body, labels and anything small. Rounder and quieter, and it
 *     stays legible at 11px where a display face would not.
 *
 * The critical React Native detail: **custom fonts do not synthesise weights.**
 * Setting `fontWeight: '700'` alongside a custom `fontFamily` silently does
 * nothing on iOS — you get the regular weight. Every weight must be a separately
 * loaded file referenced by its own family name, which is why the tokens below
 * name faces rather than pairing a family with a numeric weight.
 */

export const fonts = {
  // Display face — money figures, headings, anything that should feel spoken.
  displayMedium: 'SpaceGrotesk_500Medium',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',

  // Text face — everything else.
  bodyRegular: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtrabold: 'Manrope_800ExtraBold',
} as const;

export type FontName = (typeof fonts)[keyof typeof fonts];
