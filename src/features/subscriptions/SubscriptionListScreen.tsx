import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { getBrand } from '@/data/brands';
import { useAppStore } from '@/data/store';
import { describeCycle } from '@/domain/cycle';
import { formatDateShort, todayIso } from '@/domain/date';
import { formatMoney } from '@/domain/money';
import {
  monthlyCostMinor,
  nextBillingDate,
  Subscription,
  SubscriptionStatus,
} from '@/domain/subscription';
import { toMoney } from '@/domain/totals';
import { BrandIcon } from '@/ui/BrandIcon';
import { toAccent } from '@/ui/color';
import { Card, Screen, Txt } from '@/ui/primitives';
import { palette, radius, spacing } from '@/ui/theme';
import {
  FILTER_LABELS,
  filterCounts,
  listSubscriptions,
  SORT_LABELS,
  SortKey,
  StatusFilter,
} from './listing';

/**
 * Everything you pay for, in one list.
 *
 * The dashboard answers "what happens next"; this answers "what do I have".
 * Different question, so it sorts and filters rather than leading with the
 * imminent charge.
 */
export function SubscriptionListScreen() {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('next');

  const today = todayIso();
  const counts = useMemo(() => filterCounts(subscriptions), [subscriptions]);
  const visible = useMemo(
    () => listSubscriptions(subscriptions, { query, filter, sort, today }),
    [subscriptions, query, filter, sort, today],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">All subscriptions</Txt>
        <Txt variant="body" color={palette.textMuted}>
          {counts.all} tracked · {counts.active + counts.trial} billing
        </Txt>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name, category or note…"
        placeholderTextColor={palette.textFaint}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />

      <View style={styles.chipRow}>
        {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => (
          <Chip
            key={key}
            label={`${FILTER_LABELS[key]} ${counts[key]}`}
            active={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </View>

      <View style={styles.chipRow}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <Chip
            key={key}
            label={SORT_LABELS[key]}
            active={sort === key}
            subtle
            onPress={() => setSort(key)}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <Txt variant="body" color={palette.textFaint} style={styles.empty}>
          {subscriptions.length === 0
            ? 'Nothing tracked yet.'
            : 'Nothing matches that filter.'}
        </Txt>
      ) : (
        <View style={styles.list}>
          {visible.map((subscription) => (
            <SwipeableRow key={subscription.id} subscription={subscription} today={today} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Chip({
  label,
  active,
  subtle,
  onPress,
}: {
  label: string;
  active: boolean;
  subtle?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        subtle && styles.chipSubtle,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}>
      <Txt variant="label" color={active ? palette.bg : palette.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

/**
 * A row with swipe-to-act.
 *
 * Pause and delete are the two things you reach for repeatedly, and burying
 * them behind tap → detail → scroll makes tidying up a chore. Delete still
 * confirms, because there is no undo.
 */
function SwipeableRow({
  subscription,
  today,
}: {
  subscription: Subscription;
  today: string;
}) {
  const setStatus = useAppStore((state) => state.setStatus);
  const removeSubscription = useAppStore((state) => state.removeSubscription);
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const accent = toAccent(getBrand(subscription.brandId)?.hex ?? subscription.color);
  const next = nextBillingDate(subscription, today);
  const billing = subscription.status === 'active' || subscription.status === 'trial';
  const monthly = toMoney(monthlyCostMinor(subscription), subscription.price.currency);

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextStatus: SubscriptionStatus = billing ? 'paused' : 'active';
    setStatus(subscription.id, nextStatus);
    swipeRef.current?.close();
  };

  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      `Delete ${subscription.name}?`,
      'This removes it and its price history. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeRef.current?.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeSubscription(subscription.id),
        },
      ],
    );
  };

  const renderActions = (
    _progress: SharedValue<number>,
    translation: SharedValue<number>,
  ) => (
    <RowActions
      translation={translation}
      onPause={togglePause}
      onDelete={confirmDelete}
      billing={billing}
    />
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={renderActions}
      overshootRight={false}>
      <Card
        accent={accent}
        style={styles.row}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/subscription/[id]', params: { id: subscription.id } });
        }}>
        <View style={[styles.edge, { backgroundColor: accent }]} />
        <View style={!billing ? styles.dimmed : undefined}>
          <BrandIcon brandId={subscription.brandId} name={subscription.name} size={40} />
        </View>

        <View style={styles.rowText}>
          <Txt variant="heading" numberOfLines={1} color={billing ? palette.text : palette.textMuted}>
            {subscription.name}
          </Txt>
          <Txt variant="label" color={palette.textFaint} numberOfLines={1}>
            {billing && next
              ? `${describeCycle(subscription.cycle)} · next ${formatDateShort(next)}`
              : subscription.status === 'paused'
                ? 'Paused'
                : 'Cancelled'}
          </Txt>
        </View>

        <View style={styles.rowRight}>
          <Txt variant="heading" color={billing ? palette.text : palette.textFaint}>
            {formatMoney(subscription.price)}
          </Txt>
          {billing && subscription.cycle.unit !== 'month' && (
            <Txt variant="caption" color={palette.textFaint}>
              {formatMoney(monthly)}/MO
            </Txt>
          )}
        </View>
      </Card>
    </ReanimatedSwipeable>
  );
}

function RowActions({
  translation,
  onPause,
  onDelete,
  billing,
}: {
  translation: SharedValue<number>;
  onPause: () => void;
  onDelete: () => void;
  billing: boolean;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + ACTIONS_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.actions, style]}>
      <Pressable onPress={onPause} style={[styles.action, styles.pauseAction]}>
        <Txt variant="label" color={palette.bg}>
          {billing ? 'Pause' : 'Resume'}
        </Txt>
      </Pressable>
      <Pressable onPress={onDelete} style={[styles.action, styles.deleteAction]}>
        <Txt variant="label" color={palette.bg}>
          Delete
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

const ACTIONS_WIDTH = 160;

const styles = StyleSheet.create({
  header: { gap: 2, paddingTop: spacing.sm },
  search: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipSubtle: { backgroundColor: 'transparent' },
  chipActive: { backgroundColor: palette.text, borderColor: palette.text },
  pressed: { opacity: 0.6 },

  list: { gap: spacing.sm + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  rowText: { flex: 1, gap: 1 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  dimmed: { opacity: 0.45 },

  actions: { width: ACTIONS_WIDTH, flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  pauseAction: { backgroundColor: palette.warning },
  deleteAction: { backgroundColor: palette.danger },

  empty: { paddingVertical: spacing.xl },
});
