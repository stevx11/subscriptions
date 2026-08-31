import {
  BRANDS,
  colorForName,
  getBrand,
  monogramFor,
  readableTextOn,
  searchBrands,
} from './brands';
import { CURRENT_SCHEMA_VERSION, migrateState } from './migrations';

describe('catalogue integrity', () => {
  it('has a decent number of brands', () => {
    expect(BRANDS.length).toBeGreaterThan(80);
  });

  it('has unique ids', () => {
    const ids = BRANDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every brand a valid hex colour', () => {
    for (const brand of BRANDS) {
      expect(brand.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('gives every brand a non-empty title and category', () => {
    for (const brand of BRANDS) {
      expect(brand.title.length).toBeGreaterThan(0);
      expect(brand.category.length).toBeGreaterThan(0);
    }
  });

  it('has plausible SVG path data wherever a path exists', () => {
    const withPaths = BRANDS.filter((b) => b.path);
    expect(withPaths.length).toBeGreaterThan(70);
    for (const brand of withPaths) {
      // Lowercase 'm' is a valid relative moveto; simple-icons uses both.
      expect(brand.path!).toMatch(/^[Mm]/);
      expect(brand.path!.length).toBeGreaterThan(20);
    }
  });

  it('includes the big names that simple-icons dropped, as monograms', () => {
    for (const id of ['amazon', 'adobe', 'xbox', 'chatgpt', 'disneyplus', 'microsoft365']) {
      const brand = getBrand(id);
      expect(brand).toBeDefined();
      expect(brand!.path).toBeUndefined();
    }
  });

  it('still has real logos for the headline brands', () => {
    for (const id of ['netflix', 'spotify', 'youtube', 'steam']) {
      expect(getBrand(id)?.path).toBeTruthy();
    }
  });
});

describe('searchBrands', () => {
  it('ranks a prefix match first', () => {
    expect(searchBrands('net')[0].id).toBe('netflix');
    expect(searchBrands('spot')[0].id).toBe('spotify');
  });

  it('is case-insensitive', () => {
    expect(searchBrands('NETFLIX')[0].id).toBe('netflix');
  });

  it('finds a brand through an alias', () => {
    const ids = searchBrands('openai').map((b) => b.id);
    expect(ids).toContain('chatgpt');
  });

  it('finds Prime Video by searching amazon', () => {
    const ids = searchBrands('amazon').map((b) => b.id);
    expect(ids).toContain('primevideo');
  });

  it('returns everything (up to the limit) for an empty query', () => {
    expect(searchBrands('').length).toBeGreaterThan(10);
  });

  it('returns nothing for gibberish', () => {
    expect(searchBrands('zzzzqqqq')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(searchBrands('', 5)).toHaveLength(5);
  });
});

describe('monogramFor', () => {
  it.each([
    ['Netflix', 'N'],
    ['Prime Video', 'PV'],
    ['Disney+', 'D'],
    ['Microsoft 365', 'M3'],
    ['bank of america', 'BA'],
    ['adobe-creative-cloud', 'AC'],
  ])('%s → %s', (input, expected) => {
    expect(monogramFor(input)).toBe(expected);
  });

  it('handles empty and symbol-only input without crashing', () => {
    expect(monogramFor('')).toBe('?');
    expect(monogramFor('!!!')).toBe('?');
  });
});

describe('colorForName', () => {
  it('is deterministic', () => {
    expect(colorForName('My Gym')).toBe(colorForName('My Gym'));
  });

  it('differs between different names', () => {
    expect(colorForName('Alpha')).not.toBe(colorForName('Beta'));
  });

  it('always produces a valid hex colour', () => {
    for (const name of ['a', 'Gym', 'Very Long Subscription Name', 'ĆŠŽ', '123']) {
      expect(colorForName(name)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('readableTextOn', () => {
  it('picks black on light backgrounds', () => {
    expect(readableTextOn('#FFFFFF')).toBe('#000000');
    expect(readableTextOn('#1DB954')).toBe('#000000'); // Spotify green
  });

  it('picks white on dark backgrounds', () => {
    expect(readableTextOn('#000000')).toBe('#FFFFFF');
    expect(readableTextOn('#113CCF')).toBe('#FFFFFF'); // Disney+ blue
    expect(readableTextOn('#E50914')).toBe('#FFFFFF'); // Netflix red
  });

  it('weights green above blue, as perception does', () => {
    // Pure blue is far darker to the eye than pure green at the same value.
    expect(readableTextOn('#0000FF')).toBe('#FFFFFF');
    expect(readableTextOn('#00FF00')).toBe('#000000');
  });
});

describe('migrateState', () => {
  it('returns an empty shape for missing state', () => {
    expect(migrateState(undefined, 0)).toEqual({ subscriptions: [], settings: {} });
  });

  it('passes current-version state through unchanged', () => {
    const state = { subscriptions: [{ id: 'a' }], settings: { homeCurrency: 'EUR' } };
    expect(migrateState(state, CURRENT_SCHEMA_VERSION)).toEqual(state);
  });

  it('leaves newer state alone rather than mangling it on a downgrade', () => {
    const future = { subscriptions: [], settings: {}, somethingNew: true };
    expect(migrateState(future, CURRENT_SCHEMA_VERSION + 5)).toEqual(future);
  });
});
