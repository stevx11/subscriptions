import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { BRANDS, Brand, searchBrands } from '@/data/brands';
import { BrandIcon } from '@/ui/BrandIcon';
import { Screen, Txt } from '@/ui/primitives';
import { palette, radius, spacing } from '@/ui/theme';

/**
 * Step one of adding a subscription: pick the brand.
 *
 * The grid comes first and search is optional, because recognising a logo is
 * faster than typing a name — and one tap here fills in the name, colour, icon
 * and category, leaving only the amount to enter.
 */
export function BrandPickerScreen({
  onPick,
  onCustom,
  onCancel,
}: {
  onPick: (brand: Brand) => void;
  onCustom: (name: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query === '' ? BRANDS : searchBrands(query, 200)), [query]);
  const trimmed = query.trim();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Txt variant="label" color={palette.textMuted}>
            Cancel
          </Txt>
        </Pressable>
        <Txt variant="heading">Add subscription</Txt>
        {/* Balances the row so the title stays centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search 87 services…"
        placeholderTextColor={palette.textFaint}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={styles.search}
      />

      {/* Always reachable, not buried behind an empty search: plenty of real
          subscriptions are a gym or a landlord and have no logo anywhere. */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onCustom(trimmed);
        }}
        style={({ pressed }) => [styles.customRow, pressed && styles.pressed]}>
        <View style={styles.customIcon}>
          <Txt variant="title" color={palette.textMuted}>
            +
          </Txt>
        </View>
        <View style={styles.customText}>
          <Txt variant="heading">
            {trimmed === '' ? 'Something else' : `Add “${trimmed}”`}
          </Txt>
          <Txt variant="label" color={palette.textFaint}>
            A gym, rent, anything without a logo
          </Txt>
        </View>
      </Pressable>

      {results.length === 0 ? (
        <Txt variant="body" color={palette.textFaint} style={styles.noResults}>
          No service matches “{trimmed}”. Use the option above to add it by hand.
        </Txt>
      ) : (
        <View style={styles.grid}>
          {results.map((brand) => (
            <Pressable
              key={brand.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPick(brand);
              }}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
              <BrandIcon brandId={brand.id} name={brand.title} size={56} />
              <Txt variant="caption" color={palette.textMuted} numberOfLines={2}>
                {brand.title}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerSpacer: { width: 52 },

  search: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: 16,
  },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    padding: spacing.md,
  },
  customIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: { flex: 1, gap: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.lg },
  tile: { width: 76, alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.6 },
  noResults: { lineHeight: 21 },
});
