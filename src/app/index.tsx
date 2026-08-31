import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { BRANDS, CATEGORIES, searchBrands } from '@/data/brands';
import { useAppStore } from '@/data/store';
import { BrandIcon } from '@/ui/BrandIcon';
import { CYCLE_PRESETS } from '@/domain/cycle';
import { formatMoney, money } from '@/domain/money';
import { todayIso } from '@/domain/date';
import { computeTotals } from '@/domain/totals';

/**
 * Phase 2 verification screen.
 *
 * Two things to see here:
 *   1. Every brand tile, so logo rendering can be checked on a real display
 *      rather than in a browser that lies about scaling.
 *   2. A persistence probe — add rows, force-quit the app, reopen, and they
 *      should still be there. That is the only way to prove AsyncStorage
 *      rehydration actually works.
 *
 * Replaced by the real dashboard in Phase 5.
 */
export default function BrandGalleryScreen() {
  const [query, setQuery] = useState('');
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const hydrated = useAppStore((state) => state.hydrated);
  const addSubscription = useAppStore((state) => state.addSubscription);
  const removeSubscription = useAppStore((state) => state.removeSubscription);

  const results = useMemo(() => searchBrands(query, 200), [query]);
  const totals = useMemo(
    () => computeTotals(subscriptions, settings.homeCurrency, null),
    [subscriptions, settings.homeCurrency],
  );

  const handleAdd = (brandId: string, title: string, hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addSubscription({
      name: title,
      brandId,
      color: hex,
      category: BRANDS.find((b) => b.id === brandId)?.category ?? 'Other',
      price: money(999, settings.homeCurrency),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: todayIso(),
      status: 'active',
      reminderDaysBefore: null,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PHASE 2 · CATALOGUE &amp; STORAGE</Text>
        <Text style={styles.title}>{BRANDS.length} brands</Text>
        <Text style={styles.subtitle}>Every one with real artwork</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search brands…"
          placeholderTextColor="#5A6875"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.search}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        <View style={styles.savedCard}>
          <Text style={styles.sectionLabel}>PERSISTENCE PROBE</Text>
          <Text style={styles.savedHint}>
            {hydrated ? 'Loaded from storage.' : 'Loading…'} Tap any tile below to save
            it, then force-quit the app and reopen — these should survive.
          </Text>

          {subscriptions.length === 0 ? (
            <Text style={styles.empty}>Nothing saved yet.</Text>
          ) : (
            <>
              <Text style={styles.totalLine}>
                {subscriptions.length} saved · {formatMoney(totals.monthly)}/mo ·{' '}
                {formatMoney(totals.yearly)}/yr
              </Text>
              {subscriptions.map((sub) => (
                <Pressable
                  key={sub.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    removeSubscription(sub.id);
                  }}
                  style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}>
                  <BrandIcon brandId={sub.brandId} name={sub.name} size={34} />
                  <View style={styles.savedText}>
                    <Text style={styles.savedName}>{sub.name}</Text>
                    <Text style={styles.savedMeta}>
                      {formatMoney(sub.price)} · monthly · next {sub.anchorDate}
                    </Text>
                  </View>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>

        {query === '' ? (
          CATEGORIES.map((category) => {
            const inCategory = BRANDS.filter((b) => b.category === category);
            if (inCategory.length === 0) return null;
            return (
              <View key={category} style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {category.toUpperCase()} · {inCategory.length}
                </Text>
                <View style={styles.grid}>
                  {inCategory.map((brand) => (
                    <Tile
                      key={brand.id}
                      id={brand.id}
                      title={brand.title}
                      hex={brand.hex}
                      onPress={handleAdd}
                    />
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{results.length} RESULTS</Text>
            <View style={styles.grid}>
              {results.map((brand) => (
                <Tile
                  key={brand.id}
                  id={brand.id}
                  title={brand.title}
                  hex={brand.hex}
                  onPress={handleAdd}
                />
              ))}
            </View>
            {results.length === 0 && (
              <Text style={styles.empty}>
                No brand matches “{query}”. In the real app this becomes a
                &ldquo;create custom&rdquo; tile.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  id,
  title,
  hex,
  onPress,
}: {
  id: string;
  title: string;
  hex: string;
  onPress: (id: string, title: string, hex: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(id, title, hex)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <BrandIcon brandId={id} name={title} size={54} />
      <Text numberOfLines={2} style={styles.tileLabel}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1319' },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  eyebrow: { color: '#6B7C8C', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: '#F2F5F7', fontSize: 30, fontWeight: '800', marginTop: 2 },
  subtitle: { color: '#8496A6', fontSize: 13, marginTop: 2 },
  search: {
    marginTop: 14,
    backgroundColor: '#161C24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222B36',
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F2F5F7',
    fontSize: 15,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 22 },

  savedCard: {
    backgroundColor: '#161C24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222B36',
    padding: 14,
    gap: 8,
  },
  savedHint: { color: '#8496A6', fontSize: 12, lineHeight: 18 },
  totalLine: { color: '#5BD99A', fontSize: 13, fontWeight: '700' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  savedText: { flex: 1 },
  savedName: { color: '#E8EEF3', fontSize: 14, fontWeight: '600' },
  savedMeta: { color: '#6B7C8C', fontSize: 11, marginTop: 1 },
  remove: { color: '#E5737B', fontSize: 12, fontWeight: '600' },

  section: { gap: 10 },
  sectionLabel: { color: '#6B7C8C', fontSize: 11, letterSpacing: 1.4, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: 72, alignItems: 'center', gap: 6 },
  tileLabel: { color: '#A9BAC8', fontSize: 10, textAlign: 'center', lineHeight: 13 },
  pressed: { opacity: 0.6 },

  empty: { color: '#5A6875', fontSize: 13, fontStyle: 'italic' },
});
