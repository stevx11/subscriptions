import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  Brand,
  colorForName,
  getBrand,
  monogramFor,
  readableTextOn,
} from '@/data/brands';

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
 * Three tiers, so there is never an empty square:
 *   1. A real logo path from simple-icons.
 *   2. A monogram in the official brand colour, for brands simple-icons has
 *      removed over trademark policy (Amazon, Adobe, Xbox, …).
 *   3. A monogram in a colour hashed from the name, for anything hand-entered.
 *
 * Logo paths are single-colour silhouettes on a 24x24 viewBox, so they are
 * tinted rather than drawn in the brand's own colour — a white Netflix
 * silhouette on a red tile, not red-on-red.
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
  const background = color ?? brand?.hex ?? colorForName(name);
  const foreground = useMemo(() => readableTextOn(background), [background]);

  if (variant === 'bare' && brand?.path) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path d={brand.path} fill={background} />
      </Svg>
    );
  }

  const radius = size * 0.28;

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: background },
        style,
      ]}>
      {brand?.path ? (
        <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
          <Path d={brand.path} fill={foreground} />
        </Svg>
      ) : (
        <Text
          allowFontScaling={false}
          style={[
            styles.monogram,
            { color: foreground, fontSize: size * (monogramFor(name).length > 1 ? 0.34 : 0.42) },
          ]}>
          {monogramFor(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogram: {
    fontWeight: '700',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});

export const BrandIcon = memo(BrandIconComponent);
