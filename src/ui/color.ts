/**
 * Colour maths for the brand-forward design.
 *
 * The whole visual direction rests on tinting surfaces with each
 * subscription's own colour. Done naively that falls apart immediately,
 * because brand colours are not comparable: Prime Video's navy (#1F2E3E) is
 * nearly black and vanishes against a dark background, while Snapchat yellow
 * is so bright it dominates everything next to it. Tinting with the raw hex
 * gives some rows an invisible wash and others a glaring one.
 *
 * So raw brand colours are used only where the brand should be literal — the
 * logo tile. Everywhere the colour becomes part of the *interface* (card
 * tints, borders, accent text) it goes through `toAccent`, which pins
 * lightness and saturation into a narrow band. The hue survives, so Netflix
 * still reads red and Spotify still reads green, but every row carries the
 * same visual weight.
 */

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToHsl(hex: string): Hsl {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    h = 60 * ((b - r) / delta + 2);
  } else {
    h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [chroma, secondary, 0];
  else if (h < 120) rgb = [secondary, chroma, 0];
  else if (h < 180) rgb = [0, chroma, secondary];
  else if (h < 240) rgb = [0, secondary, chroma];
  else if (h < 300) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  return rgbToHex((rgb[0] + match) * 255, (rgb[1] + match) * 255, (rgb[2] + match) * 255);
}

/**
 * Normalise a brand colour into one usable as an interface accent.
 *
 * Keeps the hue, forces lightness into a readable band on a dark background,
 * and floors saturation so near-grey brands (Apple, GitHub, Midjourney) still
 * get a visible identity instead of collapsing into the background.
 */
export function toAccent(hex: string): string {
  const { h, s, l } = hexToHsl(hex);

  // A near-greyscale brand has no meaningful hue to preserve; give it the
  // interface's own cool tone rather than an arbitrary one.
  if (s < 0.08) {
    return hslToHex({ h: 215, s: 0.18, l: 0.62 });
  }

  return hslToHex({
    h,
    s: Math.min(0.82, Math.max(0.48, s)),
    l: Math.min(0.68, Math.max(0.56, l)),
  });
}

/** `rgba()` string for a hex colour at a given opacity. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Move a colour toward white (positive) or black (negative). -1..1 */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const weight = Math.abs(amount);
  return rgbToHex(
    r + (target - r) * weight,
    g + (target - g) * weight,
    b + (target - b) * weight,
  );
}

/** Blend two colours. `weight` 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(ar + (br - ar) * w, ag + (bg - ag) * w, ab + (bb - ab) * w);
}

export function relativeLuminance(hex: string): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
