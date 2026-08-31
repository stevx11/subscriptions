/**
 * Design tokens.
 *
 * Structured as a palette object rather than scattered literals so a light
 * theme stays possible later: adding one is defining a second `palette` and
 * threading it through, not rewriting every component. Nothing outside this
 * file should contain a raw colour hex.
 *
 * Direction B — brand-forward. The interface itself is almost monochrome:
 * near-black grounds, cool greys for text. All the colour on screen comes from
 * the subscriptions themselves, routed through `toAccent` so no single brand
 * shouts louder than the rest. That is what keeps twenty colourful rows
 * looking like a set rather than a paint chart.
 */

export const palette = {
  // Grounds, darkest to lightest.
  bg: '#0A0D12',
  surface: '#12161D',
  surfaceRaised: '#181D26',
  border: '#232A35',
  borderStrong: '#2E3742',

  // Text, most to least prominent.
  text: '#F4F7FA',
  textMuted: '#94A3B2',
  textFaint: '#63717F',

  // Semantic. Used sparingly — brand colour does most of the work.
  positive: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/**
 * Type scale. Sizes are deliberately few — a scale with eleven steps is a
 * scale nobody follows.
 */
export const type = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
} as const;

/**
 * Shadows are nearly invisible on a near-black ground, so depth comes from
 * borders and surface lightness instead. This is kept for the few places a
 * genuine lift helps — the hero card, and anything floating over content.
 */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

/** Tint strengths for brand-coloured surfaces, so they stay consistent. */
export const tint = {
  hero: 0.2,
  card: 0.11,
  cardPressed: 0.17,
  border: 0.32,
  chip: 0.16,
} as const;

export const theme = { palette, spacing, radius, type, elevation, tint } as const;
export type Theme = typeof theme;
