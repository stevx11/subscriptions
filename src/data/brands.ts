/**
 * The brand catalogue behind the add-subscription picker.
 *
 * Two sources feed it:
 *
 *  1. `brands.generated.ts` — 76 real logos extracted from simple-icons.
 *  2. `MONOGRAM_BRANDS` below — brands simple-icons has *removed* over
 *     trademark policy (Amazon, Adobe, Microsoft, Xbox, Nintendo, Slack,
 *     OpenAI, Disney+, Prime Video and friends). These are among the most
 *     commonly held subscriptions, so dropping them would be a real gap.
 *     They keep their official brand colour and render as a monogram tile,
 *     which reads as a deliberate design choice rather than a missing image.
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
 * Brand colours here are the companies' own published colours, used purely to
 * make each tile recognisable at a glance.
 */
const MONOGRAM_BRANDS: readonly Brand[] = [
  { id: 'primevideo', title: 'Prime Video', hex: '#00A8E1', category: 'Video', aliases: ['amazon'] },
  { id: 'disneyplus', title: 'Disney+', hex: '#113CCF', category: 'Video', aliases: ['disney'] },
  { id: 'hulu', title: 'Hulu', hex: '#1CE783', category: 'Video' },
  { id: 'skyshowtime', title: 'SkyShowtime', hex: '#0072C9', category: 'Video' },
  { id: 'xbox', title: 'Xbox Game Pass', hex: '#107C10', category: 'Gaming', aliases: ['game pass'] },
  { id: 'nintendo', title: 'Nintendo Switch Online', hex: '#E60012', category: 'Gaming', aliases: ['switch'] },
  { id: 'chatgpt', title: 'ChatGPT', hex: '#10A37F', category: 'AI', aliases: ['openai', 'gpt'] },
  { id: 'midjourney', title: 'Midjourney', hex: '#4B4B4B', category: 'AI' },
  { id: 'adobe', title: 'Adobe Creative Cloud', hex: '#FA0F00', category: 'Software', aliases: ['photoshop', 'creative cloud'] },
  { id: 'microsoft365', title: 'Microsoft 365', hex: '#D83B01', category: 'Software', aliases: ['office', 'word', 'excel'] },
  { id: 'canva', title: 'Canva', hex: '#00C4CC', category: 'Software' },
  { id: 'slack', title: 'Slack', hex: '#4A154B', category: 'Software' },
  { id: 'googleone', title: 'Google One', hex: '#4285F4', category: 'Cloud', aliases: ['google storage'] },
  { id: 'amazon', title: 'Amazon Prime', hex: '#FF9900', category: 'Shopping', aliases: ['prime'] },
  { id: 'myfitnesspal', title: 'MyFitnessPal', hex: '#0066EE', category: 'Fitness' },
  { id: 'pocket', title: 'Pocket', hex: '#EF3F56', category: 'Reading' },
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
