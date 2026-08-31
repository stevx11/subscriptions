import {
  contrastRatio,
  hexToHsl,
  hslToHex,
  mix,
  relativeLuminance,
  shade,
  toAccent,
  withAlpha,
} from './color';

describe('hex/hsl round-tripping', () => {
  it.each(['#E50914', '#1DB954', '#00A8E1', '#FFFFFF', '#000000', '#7F7F7F'])(
    'round-trips %s within rounding error',
    (hex) => {
      const back = hslToHex(hexToHsl(hex));
      // Allow 1/255 drift per channel from the float conversion.
      for (let i = 1; i < 7; i += 2) {
        const a = parseInt(hex.slice(i, i + 2), 16);
        const b = parseInt(back.slice(i, i + 2), 16);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
      }
    },
  );

  it('reads greyscale as zero saturation', () => {
    expect(hexToHsl('#808080').s).toBe(0);
  });
});

describe('toAccent', () => {
  /**
   * The point of the whole function: brand colours span from nearly black to
   * nearly white, and tinting a dark UI with the raw value makes some rows
   * invisible and others blinding.
   */
  it('lifts a near-black brand into the visible band', () => {
    const accent = toAccent('#000000');
    expect(hexToHsl(accent).l).toBeGreaterThan(0.5);
  });

  it('pulls a blinding brand down into the same band', () => {
    const accent = toAccent('#FFFF00');
    expect(hexToHsl(accent).l).toBeLessThan(0.7);
  });

  it('lands every catalogue-ish colour in one narrow lightness band', () => {
    const brands = ['#E50914', '#1DB954', '#00A8E1', '#1F2E3E', '#58CC02', '#FA0F00', '#000000'];
    const lightness = brands.map((hex) => hexToHsl(toAccent(hex)).l);
    expect(Math.min(...lightness)).toBeGreaterThanOrEqual(0.55);
    expect(Math.max(...lightness)).toBeLessThanOrEqual(0.69);
  });

  it('preserves hue so brands stay recognisable', () => {
    // Netflix must still read red, Spotify still green.
    expect(Math.abs(hexToHsl(toAccent('#E50914')).h - hexToHsl('#E50914').h)).toBeLessThan(2);
    expect(Math.abs(hexToHsl(toAccent('#1DB954')).h - hexToHsl('#1DB954').h)).toBeLessThan(2);
  });

  it('gives greyscale brands the interface tone rather than a random hue', () => {
    // Round-tripping through 8-bit hex quantises the hue by a degree or so.
    const accent = toAccent('#000000');
    expect(Math.abs(hexToHsl(accent).h - 215)).toBeLessThanOrEqual(2);
  });

  it('produces accents readable against the app background', () => {
    for (const hex of ['#000000', '#1F2E3E', '#E50914', '#58CC02', '#FFFF00']) {
      expect(contrastRatio(toAccent(hex), '#0A0D12')).toBeGreaterThan(3);
    }
  });
});

describe('withAlpha', () => {
  it('builds an rgba string', () => {
    expect(withAlpha('#E50914', 0.5)).toBe('rgba(229, 9, 20, 0.5)');
  });

  it('clamps out-of-range alpha', () => {
    expect(withAlpha('#000000', 5)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#000000', -2)).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('shade and mix', () => {
  it('lightens toward white and darkens toward black', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 0)).toBe('#808080');
  });

  it('mixes endpoints', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#ffffff');
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('contrast', () => {
  it('matches the known black-on-white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#E50914', '#0A0D12')).toBeCloseTo(
      contrastRatio('#0A0D12', '#E50914'),
      6,
    );
  });

  it('ranks green as brighter than blue', () => {
    expect(relativeLuminance('#00FF00')).toBeGreaterThan(relativeLuminance('#0000FF'));
  });
});
