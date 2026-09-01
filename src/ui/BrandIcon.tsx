import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  Brand,
  colorForName,
  getBrand,
  monogramFor,
  readableTextOn,
} from '@/data/brands';
import { shade } from './color';
import { fonts } from './fonts';

interface BrandIconProps {
  /** Catalogue id. Falls back to a monogram when absent or unknown. */
  brandId?: string;
  /** Used for the monogram and its generated colour when there is no brand. */
  name: string;
  size?: number;
  /** Overrides the brand's own colour. */
  color?: string;
  style?: ViewStyle;
  /** Square tile with the logo knocked out, versus the bare glyph. */
  variant?: 'tile' | 'bare';
}


/**
 * Renders a subscription's logo.
 *
 * Two tiers, so there is never an empty square:
 *   1. A real logo path — every brand in the catalogue has one, including the
 *      ones the current simple-icons release has delisted (the generator falls
 *      back to older versions for those).
 *   2. A monogram on a colour hashed from the name, for subscriptions the user
 *      typed in by hand. Those have no logo anywhere and always will not.
 *
 * The monogram is deliberately not a flat colour block. A diagonal gradient
 * plus a hairline inner highlight is what makes a plain square read as an app
 * icon rather than a placeholder, and it costs one extra SVG node.
 *
 * Logo paths are single-colour silhouettes on a 24x24 viewBox, so they are
 * tinted for contrast rather than drawn in the brand colour — a white Netflix
 * silhouette on a red tile, not red on red.
 */
function BrandIconComponent({
  brandId,
  name,
  size = 44,
  color,
  style,
  variant = 'tile',
}: BrandIconProps) {
  const brand: Brand | undefined = getBrand(brandId);
  const base = color ?? brand?.hex ?? colorForName(name);
  const foreground = useMemo(() => readableTextOn(base), [base]);
  const monogram = useMemo(() => monogramFor(name), [name]);

  if (variant === 'bare' && brand?.path) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path d={brand.path} fill={base} />
      </Svg>
    );
  }

  const radius = size * 0.26;
  const gradientId = `tile-${(brandId ?? name).replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={shade(base, 0.16)} />
            <Stop offset="1" stopColor={shade(base, -0.2)} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={radius} ry={radius} fill={`url(#${gradientId})`} />
        <Rect
          x={0.5}
          y={0.5}
          width={size - 1}
          height={size - 1}
          rx={radius - 0.5}
          ry={radius - 0.5}
          fill="none"
          stroke={foreground === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'}
          strokeWidth={1}
        />
      </Svg>

      <View style={styles.center}>
        {brand?.path ? (
          <Svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24">
            <Path d={brand.path} fill={foreground} />
          </Svg>
        ) : (
          <Text
            allowFontScaling={false}
            style={[
              styles.monogram,
              {
                color: foreground,
                fontSize: size * (monogram.length > 1 ? 0.36 : 0.44),
                // Two-letter monograms read better slightly tightened.
                letterSpacing: monogram.length > 1 ? -size * 0.012 : 0,
                opacity: foreground === '#FFFFFF' ? 0.95 : 0.82,
              },
            ]}>
            {monogram}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontFamily: fonts.displayBold,
    includeFontPadding: false,
    textAlign: 'center',
  },
});

export const BrandIcon = memo(BrandIconComponent);
