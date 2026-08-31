/**
 * The brand catalogue behind the add-subscription picker.
 *
 * Two sources feed it:
 *
 *  1. `brands.generated.ts` — 87 real logos. The generator pulls from the
 *     current simple-icons release and falls back to older ones for brands
 *     that have since been delisted (Amazon, Adobe, Xbox, OpenAI, Slack…),
 *     so those keep their genuine artwork rather than degrading to initials.
 *  2. `MONOGRAM_BRANDS` below — the few that appear in no release at all.
 *
 * Anything the user types that matches neither still gets a tile: a monogram
 * on a colour derived from the name, so the grid never shows a hole.
 */

import { GENERATED_BRANDS } from './brands.generated';

export interface Brand {
  id: string;
  title: string;
  /** Official brand colour, "#RRGGBB". */
  hex: string;
  category: string;
  /** SVG path on a 24x24 viewBox. Absent for monogram-only brands. */
  path?: string;
  /** Extra search terms — "prime video" should also match "amazon". */
  aliases?: readonly string[];
}

/**
 * The four brands that appear in no release of simple-icons, past or present.
 * They fall back to a monogram tile in their own brand colour.
 */
const MONOGRAM_BRANDS: readonly Brand[] = [
  { id: 'disneyplus', title: 'Disney+', hex: '#113CCF', category: 'Video', aliases: ['disney'] },
  { id: 'skyshowtime', title: 'SkyShowtime', hex: '#0072C9', category: 'Video' },
  { id: 'midjourney', title: 'Midjourney', hex: '#3A3A47', category: 'AI' },
  { id: 'myfitnesspal', title: 'MyFitnessPal', hex: '#0066EE', category: 'Fitness' },
];

export const BRANDS: readonly Brand[] = [...GENERATED_BRANDS, ...MONOGRAM_BRANDS].sort(
  (a, b) => a.title.localeCompare(b.title),
);

export const CATEGORIES = [
  'Video',
  'Music',
  'Gaming',
  'AI',
  'Software',
  'Cloud',
  'Security',
  'Reading',
  'Fitness',
  'Education',
  'Food',
  'Shopping',
  'Finance',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

const BY_ID = new Map(BRANDS.map((brand) => [brand.id, brand]));

export function getBrand(id: string | undefined): Brand | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

/**
 * Fuzzy-ish brand search for the picker.
 *
 * Ranks prefix matches above substring matches so typing "net" puts Netflix
 * first rather than burying it under anything containing "net". Alias matches
 * rank last — they are a safety net, not the primary signal.
 */
export function searchBrands(query: string, limit = 60): Brand[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return BRANDS.slice(0, limit);
  }

  const scored: { brand: Brand; score: number }[] = [];
  for (const brand of BRANDS) {
    const title = brand.title.toLowerCase();
    let score = -1;
    if (title.startsWith(needle)) {
      score = 0;
    } else if (title.includes(needle)) {
      score = 1;
    } else if (brand.id.includes(needle)) {
      score = 2;
    } else if (brand.aliases?.some((alias) => alias.includes(needle))) {
      score = 3;
    }
    if (score >= 0) {
      scored.push({ brand, score });
    }
  }

  return scored
    .sort((a, b) => a.score - b.score || a.brand.title.localeCompare(b.brand.title))
    .slice(0, limit)
    .map((entry) => entry.brand);
}

export function brandsByCategory(category: string): Brand[] {
  return BRANDS.filter((brand) => brand.category === category);
}

/**
 * Up to two initials for a monogram tile. "Prime Video" → "PV", "Netflix" → "N".
 * Skips connecting words so "Bank of America" gives "BA", not "BO".
 */
export function monogramFor(name: string): string {
  const skip = new Set(['of', 'the', 'and', 'for', 'a', 'an']);
  const words = name
    .split(/[\s\-_+&]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0 && !skip.has(word.toLowerCase()));

  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * A stable, reasonably pleasant colour for a name with no brand entry.
 *
 * Hashes the name to a hue and fixes saturation and lightness, so every
 * generated colour sits in the same tonal family as the rest of the UI instead
 * of producing the occasional neon accident that random RGB gives you.
 */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return hslToHex(hue, 52, 52);
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [chroma, secondary, 0];
  else if (h < 120) rgb = [secondary, chroma, 0];
  else if (h < 180) rgb = [0, chroma, secondary];
  else if (h < 240) rgb = [0, secondary, chroma];
  else if (h < 300) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  const toHex = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/**
 * Whether white or black text reads better on a given background.
 * Uses relative luminance rather than a naive brightness average, because
 * green contributes far more perceived brightness than blue does — Spotify
 * green needs black text, Disney blue needs white.
 */
export function readableTextOn(hex: string): '#000000' | '#FFFFFF' {
  const clean = hex.replace('#', '');
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(parseInt(clean.slice(0, 2), 16));
  const g = toLinear(parseInt(clean.slice(2, 4), 16));
  const b = toLinear(parseInt(clean.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Black and white have equal WCAG contrast against a background at
  // L = sqrt(1.05 * 0.05) - 0.05 = 0.1791. Above that, black wins.
  return luminance > 0.1791 ? '#000000' : '#FFFFFF';
}
