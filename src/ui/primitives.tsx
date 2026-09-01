import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from './fonts';
import { palette, radius, spacing, tint, type as typeScale } from './theme';
import { withAlpha } from './color';

/** Full-screen ground with safe-area handling. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TextVariant = keyof typeof typeScale;

export function Txt({
  variant = 'body',
  color = palette.text,
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[typeScale[variant] as TextStyle, { color }, style]}>
      {children}
    </Text>
  );
}

/**
 * A surface. Passing `accent` tints it with a brand colour — the core move of
 * this design direction. The accent must already be normalised via `toAccent`;
 * passing a raw brand hex here is what makes some cards invisible and others
 * glaring.
 */
export function Card({
  children,
  accent,
  onPress,
  style,
  strength = tint.card,
}: {
  children: ReactNode;
  accent?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  strength?: number;
}) {
  const base: ViewStyle = {
    backgroundColor: accent ? withAlpha(accent, strength) : palette.surface,
    borderColor: accent ? withAlpha(accent, tint.border) : palette.border,
  };

  if (!onPress) {
    return <View style={[styles.card, base, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        base,
        pressed && {
          backgroundColor: accent
            ? withAlpha(accent, tint.cardPressed)
            : palette.surfaceRaised,
          transform: [{ scale: 0.985 }],
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/** Small capsule for counts, day badges and status. */
export function Pill({
  children,
  accent,
  tone = 'accent',
}: {
  children: ReactNode;
  accent?: string;
  tone?: 'accent' | 'neutral' | 'warning' | 'danger';
}) {
  const color =
    tone === 'accent'
      ? (accent ?? palette.textMuted)
      : tone === 'warning'
        ? palette.warning
        : tone === 'danger'
          ? palette.danger
          : palette.textMuted;

  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, tint.chip) }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {trailing}
    </View>
  );
}

/** Thin horizontal rule for separating rows inside a card. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 11, fontFamily: fonts.bodyBold, letterSpacing: 0.2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.sm,
  },
  sectionTitle: {
    color: palette.textFaint,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.2,
  },
  divider: { height: 1, backgroundColor: palette.border },
});
