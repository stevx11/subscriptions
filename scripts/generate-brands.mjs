/**
 * Generates src/data/brands.generated.ts from simple-icons.
 *
 * Why generate rather than hand-write: an SVG path typed from memory is
 * silently wrong — it renders as a plausible-looking blob that is not the
 * brand's logo. Extracting keeps the artwork correct and the colours official.
 *
 * Why three versions: simple-icons has progressively removed major brands as
 * companies asked to be delisted. Amazon, Adobe, Slack, OpenAI, Canva and
 * Prime Video left in v14; Xbox, Hulu and Microsoft Office left earlier still.
 * Those are among the most commonly held subscriptions, so each slug is looked
 * up in the current release first and then in the older ones, taking the first
 * hit. All three are devDependencies — the generated file is committed, and
 * only the handful of paths we actually use ends up in the app bundle.
 *
 * These are third-party trademarks, used nominatively to label subscriptions
 * the user already holds, in their own personal app.
 *
 *   node scripts/generate-brands.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as current from 'simple-icons';
import * as v13 from 'simple-icons-legacy';
import * as v9 from 'simple-icons-old';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'brands.generated.ts');

/**
 * [slug, category, overrides?]
 *
 * Overrides exist because an icon's own title is often not the name of the
 * thing you subscribe to: the "microsoftoffice" glyph is what people call
 * Microsoft 365, and the OpenAI mark is what people recognise as ChatGPT.
 */
const CATALOGUE = [
  // ── Video
  ['netflix', 'Video'],
  ['youtube', 'Video', { title: 'YouTube Premium' }],
  ['primevideo', 'Video', { title: 'Prime Video', hex: '#00A8E1', aliases: ['amazon'] }],
  ['hbo', 'Video', { aliases: ['max'] }],
  ['appletv', 'Video', { title: 'Apple TV+' }],
  ['hulu', 'Video'],
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
  ['playstation', 'Gaming', { title: 'PlayStation Plus', aliases: ['ps plus', 'psn'] }],
  ['xbox', 'Gaming', { title: 'Xbox Game Pass', aliases: ['game pass'] }],
  ['nintendoswitch', 'Gaming', { title: 'Nintendo Switch Online', aliases: ['switch'] }],
  ['epicgames', 'Gaming'],
  ['ubisoft', 'Gaming'],
  ['roblox', 'Gaming'],
  ['discord', 'Gaming', { title: 'Discord Nitro' }],

  // ── AI
  ['openai', 'AI', { title: 'ChatGPT', hex: '#10A37F', aliases: ['openai', 'gpt'] }],
  ['claude', 'AI'],
  ['anthropic', 'AI'],
  ['perplexity', 'AI'],
  ['githubcopilot', 'AI', { title: 'GitHub Copilot' }],
  ['huggingface', 'AI'],

  // ── Software & productivity
  ['adobecreativecloud', 'Software', { title: 'Adobe Creative Cloud', aliases: ['photoshop', 'adobe'] }],
  ['microsoftoffice', 'Software', { title: 'Microsoft 365', hex: '#D83B01', aliases: ['office', 'word', 'excel'] }],
  ['notion', 'Software'],
  ['figma', 'Software'],
  ['canva', 'Software'],
  ['slack', 'Software'],
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
  ['icloud', 'Cloud', { title: 'iCloud+' }],
  ['googledrive', 'Cloud', { title: 'Google One', aliases: ['google storage', 'drive'] }],
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
  ['proton', 'Security', { title: 'Proton Mail' }],

  // ── Reading & news
  ['medium', 'Reading'],
  ['substack', 'Reading'],
  ['goodreads', 'Reading'],
  ['pocket', 'Reading'],

  // ── Health, fitness & learning
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
  ['amazon', 'Shopping', { title: 'Amazon Prime', hex: '#FF9900', aliases: ['prime'] }],
  ['ebay', 'Shopping'],
  ['etsy', 'Shopping'],

  // ── Money
  ['revolut', 'Finance'],
  ['wise', 'Finance'],
  ['paypal', 'Finance'],
];

function indexOf(namespace) {
  const map = new Map();
  for (const value of Object.values(namespace)) {
    if (value && typeof value === 'object' && 'slug' in value && 'path' in value) {
      map.set(value.slug, value);
    }
  }
  return map;
}

// Order matters: prefer the current release so upstream artwork fixes win.
const SOURCES = [
  { name: 'current', icons: indexOf(current) },
  { name: 'v13', icons: indexOf(v13) },
  { name: 'v9', icons: indexOf(v9) },
];

const resolved = [];
const missing = [];
const sourceCounts = {};

for (const [slug, category, overrides = {}] of CATALOGUE) {
  const hit = SOURCES.find((source) => source.icons.has(slug));
  if (!hit) {
    missing.push(slug);
    continue;
  }
  const icon = hit.icons.get(slug);
  sourceCounts[hit.name] = (sourceCounts[hit.name] ?? 0) + 1;

  resolved.push({
    id: slug,
    title: overrides.title ?? icon.title,
    hex: overrides.hex ?? `#${icon.hex}`,
    category,
    path: icon.path,
    aliases: overrides.aliases,
  });
}

if (missing.length > 0) {
  console.warn(`\n  ${missing.length} slug(s) found in no version:`);
  for (const slug of missing) console.warn(`   - ${slug}`);
  console.warn('');
}

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-brands.mjs
 *
 * Logo paths and brand colours come from simple-icons, drawing on older
 * releases for brands the current one has removed. Paths use a 24x24 viewBox.
 */

export interface GeneratedBrand {
  id: string;
  title: string;
  /** Brand colour, "#RRGGBB". */
  hex: string;
  category: string;
  /** SVG path data on a 24x24 viewBox. */
  path: string;
  aliases?: readonly string[];
}

export const GENERATED_BRANDS: readonly GeneratedBrand[] = [
`;

const body = resolved
  .map((brand) => {
    const lines = [
      `    id: ${JSON.stringify(brand.id)},`,
      `    title: ${JSON.stringify(brand.title)},`,
      `    hex: ${JSON.stringify(brand.hex)},`,
      `    category: ${JSON.stringify(brand.category)},`,
      `    path: ${JSON.stringify(brand.path)},`,
    ];
    if (brand.aliases) {
      lines.push(`    aliases: ${JSON.stringify(brand.aliases)},`);
    }
    return `  {\n${lines.join('\n')}\n  },`;
  })
  .join('\n');

writeFileSync(OUT, `${banner}${body}\n];\n`, 'utf8');

console.log(`  Wrote ${resolved.length} brands with real logos.`);
console.log(
  `  Sources: ${Object.entries(sourceCounts)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')}`,
);
if (missing.length > 0) {
  process.exitCode = 1;
}
