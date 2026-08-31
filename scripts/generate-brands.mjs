/**
 * Generates src/data/brands.generated.ts from the simple-icons package.
 *
 * Why generate rather than hand-write: an SVG path typed from memory is
 * silently wrong — it renders as a plausible-looking blob that is not the
 * brand's logo. Extracting from simple-icons keeps the artwork correct and the
 * brand colours official, and re-running this picks up upstream fixes.
 *
 * simple-icons is a devDependency: the generated file is committed, so nothing
 * ships in the app bundle except the handful of paths we actually use.
 *
 *   node scripts/generate-brands.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as simpleIcons from 'simple-icons';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'brands.generated.ts');

/**
 * The curated catalogue. Order within a category is roughly by how likely
 * someone is to have the subscription, because that ordering drives the
 * add-subscription grid.
 */
const CATALOGUE = [
  // ── Video
  ['netflix', 'Video'],
  ['youtube', 'Video'],
  ['hbo', 'Video'],
  ['appletv', 'Video'],
  ['paramountplus', 'Video'],
  ['crunchyroll', 'Video'],
  ['twitch', 'Video'],
  ['plex', 'Video'],
  ['mubi', 'Video'],
  ['vimeo', 'Video'],

  // ── Music & audio
  ['spotify', 'Music'],
  ['applemusic', 'Music'],
  ['youtubemusic', 'Music'],
  ['tidal', 'Music'],
  ['deezer', 'Music'],
  ['soundcloud', 'Music'],
  ['bandcamp', 'Music'],
  ['audible', 'Music'],

  // ── Gaming
  ['steam', 'Gaming'],
  ['playstation', 'Gaming'],
  ['epicgames', 'Gaming'],
  ['ubisoft', 'Gaming'],
  ['roblox', 'Gaming'],
  ['discord', 'Gaming'],

  // ── AI
  ['anthropic', 'AI'],
  ['claude', 'AI'],
  ['perplexity', 'AI'],
  ['githubcopilot', 'AI'],
  ['huggingface', 'AI'],

  // ── Software & productivity
  ['notion', 'Software'],
  ['figma', 'Software'],
  ['zoom', 'Software'],
  ['github', 'Software'],
  ['gitlab', 'Software'],
  ['jetbrains', 'Software'],
  ['obsidian', 'Software'],
  ['todoist', 'Software'],
  ['trello', 'Software'],
  ['asana', 'Software'],
  ['linear', 'Software'],
  ['miro', 'Software'],
  ['grammarly', 'Software'],

  // ── Cloud & storage
  ['icloud', 'Cloud'],
  ['googledrive', 'Cloud'],
  ['dropbox', 'Cloud'],
  ['mega', 'Cloud'],
  ['backblaze', 'Cloud'],
  ['digitalocean', 'Cloud'],
  ['vercel', 'Cloud'],
  ['cloudflare', 'Cloud'],

  // ── Security
  ['1password', 'Security'],
  ['bitwarden', 'Security'],
  ['nordvpn', 'Security'],
  ['expressvpn', 'Security'],
  ['protonvpn', 'Security'],
  ['proton', 'Security'],

  // ── Reading & news
  ['medium', 'Reading'],
  ['substack', 'Reading'],
  ['goodreads', 'Reading'],

  // ── Health & fitness
  ['strava', 'Fitness'],
  ['fitbit', 'Fitness'],
  ['peloton', 'Fitness'],
  ['headspace', 'Fitness'],
  ['duolingo', 'Education'],
  ['coursera', 'Education'],
  ['udemy', 'Education'],

  // ── Food & shopping
  ['ubereats', 'Food'],
  ['deliveroo', 'Food'],
  ['doordash', 'Food'],
  ['hellofresh', 'Food'],
  ['starbucks', 'Food'],
  ['ebay', 'Shopping'],
  ['etsy', 'Shopping'],

  // ── Money
  ['revolut', 'Finance'],
  ['wise', 'Finance'],
  ['paypal', 'Finance'],
];

// simple-icons exports as siPascalCase; build a slug lookup instead of guessing.
const bySlug = new Map();
for (const value of Object.values(simpleIcons)) {
  if (value && typeof value === 'object' && 'slug' in value && 'path' in value) {
    bySlug.set(value.slug, value);
  }
}

const resolved = [];
const missing = [];

for (const [slug, category] of CATALOGUE) {
  const icon = bySlug.get(slug);
  if (!icon) {
    missing.push(slug);
    continue;
  }
  resolved.push({
    id: slug,
    title: icon.title,
    hex: `#${icon.hex}`,
    category,
    path: icon.path,
  });
}

if (missing.length > 0) {
  console.warn(`\n  ${missing.length} slug(s) not found in simple-icons:`);
  for (const slug of missing) console.warn(`   - ${slug}`);
  console.warn('  Fix or remove them in scripts/generate-brands.mjs.\n');
}

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-brands.mjs
 *
 * Logo paths and brand colours come from simple-icons (CC0). Each path is
 * designed for a 24x24 viewBox.
 */

export interface GeneratedBrand {
  id: string;
  title: string;
  /** Official brand colour, "#RRGGBB". */
  hex: string;
  category: string;
  /** SVG path data on a 24x24 viewBox. */
  path: string;
}

export const GENERATED_BRANDS: readonly GeneratedBrand[] = [
`;

const body = resolved
  .map(
    (brand) =>
      `  {\n    id: ${JSON.stringify(brand.id)},\n    title: ${JSON.stringify(brand.title)},\n    hex: ${JSON.stringify(brand.hex)},\n    category: ${JSON.stringify(brand.category)},\n    path: ${JSON.stringify(brand.path)},\n  },`,
  )
  .join('\n');

writeFileSync(OUT, `${banner}${body}\n];\n`, 'utf8');

console.log(`  Wrote ${resolved.length} brands to src/data/brands.generated.ts`);
if (missing.length > 0) {
  process.exitCode = 1;
}
