import { useMemo } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { getBrand } from '@/data/brands';
import { useAppStore } from '@/data/store';
import { describeCycle } from '@/domain/cycle';
import { daysBetween, formatDateLong, todayIso } from '@/domain/date';
import { formatMoney, money } from '@/domain/money';
import {
  daysUntilNextBilling,
  isBilling,
  lastPriceChange,
  monthlyCostMinor,
  nextBillingDate,
  totalPaidMinor,
  yearlyCostMinor,
} from '@/domain/subscription';
import { dailyCostMinor, toMoney } from '@/domain/totals';
import { BrandIcon } from '@/ui/BrandIcon';
import { toAccent, withAlpha } from '@/ui/color';
import { Card, Divider, Pill, Screen, SectionHeader, Txt } from '@/ui/primitives';
import { palette, radius, spacing } from '@/ui/theme';

/**
 * Everything known about one subscription.
 *
 * Leads with what it costs you over time rather than the sticker price: the
 * per-year figure and the running total already paid are the numbers that
 * actually prompt someone to cancel something, and neither is visible anywhere
 * else in the app.
 */
export function SubscriptionDetailScreen({ id }: { id: string }) {
  const subscription = useAppStore((state) => state.subscriptions.find((s) => s.id === id));
  const setStatus = useAppStore((state) => state.setStatus);
  const updateSubscription = useAppStore((state) => state.updateSubscription);
  const removeSubscription = useAppStore((state) => state.removeSubscription);

  const today = todayIso();

  const derived = useMemo(() => {
    if (!subscription) return null;
    const currency = subscription.price.currency;
    return {
      accent: toAccent(getBrand(subscription.brandId)?.hex ?? subscription.color),
      next: nextBillingDate(subscription, today),
      days: daysUntilNextBilling(subscription, today),
      monthly: toMoney(monthlyCostMinor(subscription), currency),
      yearly: toMoney(yearlyCostMinor(subscription), currency),
      daily: toMoney(dailyCostMinor(subscription), currency),
      paid: totalPaidMinor(subscription, today),
      change: lastPriceChange(subscription),
      currency,
    };
  }, [subscription, today]);

  if (!subscription || !derived) {
    return (
      <Screen>
        <Txt variant="title">Not found</Txt>
        <Txt variant="body" color={palette.textMuted}>
          This subscription no longer exists.
        </Txt>
        <Pressable onPress={() => router.back()} style={styles.linkButton}>
          <Txt variant="label" color={palette.textMuted}>
            Go back
          </Txt>
        </Pressable>
      </Screen>
    );
  }

  const billing = isBilling(subscription);
  const { accent } = derived;

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus(subscription.id, billing ? 'paused' : 'active');
  };

  const markCancelled = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Mark ${subscription.name} as cancelled?`,
      'It stops counting toward your totals but stays in the list, so you keep the record of what you used to pay.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark cancelled', onPress: () => setStatus(subscription.id, 'cancelled') },
      ],
    );
  };

  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      `Delete ${subscription.name}?`,
      'This removes it and its price history. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeSubscription(subscription.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="label" color={palette.textMuted}>
            ‹ Back
          </Txt>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/edit/[id]', params: { id: subscription.id } })
          }
          hitSlop={12}>
          <Txt variant="label" color={accent}>
            Edit
          </Txt>
        </Pressable>
      </View>

      <View style={styles.identity}>
        <BrandIcon brandId={subscription.brandId} name={subscription.name} size={64} />
        <View style={styles.identityText}>
          <Txt variant="title" numberOfLines={2}>
            {subscription.name}
          </Txt>
          <Txt variant="label" color={palette.textFaint}>
            {subscription.category} · {describeCycle(subscription.cycle)}
          </Txt>
        </View>
      </View>

      <Card accent={accent} style={styles.priceCard}>
        <Txt variant="caption" color={accent}>
          {billing ? 'NEXT CHARGE' : subscription.status === 'paused' ? 'PAUSED' : 'CANCELLED'}
        </Txt>
        <Txt variant="display" style={styles.price}>
          {formatMoney(subscription.price)}
        </Txt>
        {billing && derived.next ? (
          <View style={styles.nextRow}>
            <Txt variant="heading">{formatDateLong(derived.next, today)}</Txt>
            {derived.days !== null && (
              <Pill accent={derived.days <= 3 ? palette.warning : accent} tone={derived.days <= 3 ? 'warning' : 'accent'}>
                {derived.days === 0 ? 'today' : derived.days === 1 ? 'tomorrow' : `in ${derived.days} days`}
              </Pill>
            )}
          </View>
        ) : (
          <Txt variant="body" color={palette.textMuted}>
            Not counted toward your totals.
          </Txt>
        )}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="What it costs you" />
        <Card style={styles.statCard}>
          <StatRow label="Per month" value={formatMoney(derived.monthly)} />
          <Divider />
          <StatRow label="Per year" value={formatMoney(derived.yearly)} />
          <Divider />
          <StatRow label="Per day" value={formatMoney(derived.daily)} />
          <Divider />
          <StatRow
            label={`Paid so far (${derived.paid.charges} ${derived.paid.charges === 1 ? 'charge' : 'charges'})`}
            value={formatMoney(toMoney(derived.paid.amountMinor, derived.currency))}
            emphasis
          />
        </Card>
      </View>

      {derived.change && (
        <Card accent={palette.warning} strength={0.1} style={styles.changeCard}>
          <Txt variant="caption" color={palette.warning}>
            PRICE CHANGED
          </Txt>
          <Txt variant="body">
            {formatMoney(derived.change.from)} → {formatMoney(derived.change.to)} on{' '}
            {formatDateLong(derived.change.since, today)}
          </Txt>
        </Card>
      )}

      {subscription.priceHistory.length > 1 && (
        <View style={styles.section}>
          <SectionHeader title="Price history" />
          <Card style={styles.statCard}>
            {[...subscription.priceHistory]
              .sort((a, b) => (a.since < b.since ? 1 : -1))
              .map((point, index, all) => (
                <View key={`${point.since}-${index}`}>
                  <StatRow
                    label={formatDateLong(point.since, today)}
                    value={formatMoney(money(point.amount, point.currency))}
                  />
                  {index < all.length - 1 && <Divider />}
                </View>
              ))}
          </Card>
        </View>
      )}

      {subscription.notes && (
        <View style={styles.section}>
          <SectionHeader title="Notes" />
          <Card>
            <Txt variant="body" color={palette.textMuted}>
              {subscription.notes}
            </Txt>
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="How much do you use it?" />
        <Card style={styles.usageCard}>
          <View style={styles.usageRow}>
            {USAGE_OPTIONS.map((option) => {
              const active = subscription.usageRating === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    // Tapping the active option clears it, so a rating can be
                    // undone without a separate control.
                    updateSubscription(subscription.id, {
                      usageRating: active ? undefined : option.value,
                    });
                  }}
                  style={({ pressed }) => [
                    styles.usageChip,
                    active && { borderColor: accent, backgroundColor: withAlpha(accent, 0.16) },
                    pressed && styles.pressed,
                  ]}>
                  <Txt variant="label" color={active ? accent : palette.textMuted}>
                    {option.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="label" color={palette.textFaint}>
            Anything you rate low shows up in Insights with what it costs a year.
          </Txt>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Started" />
        <Card style={styles.statCard}>
          <StatRow
            label={formatDateLong(subscription.anchorDate, today)}
            value={`${Math.max(0, Math.round(daysBetween(subscription.anchorDate, today) / 30))} months ago`}
          />
        </Card>
      </View>

      <View style={styles.actions}>
        {subscription.cancelUrl && (
          <ActionButton
            label="Open cancellation page"
            accent={accent}
            onPress={() => Linking.openURL(subscription.cancelUrl!)}
          />
        )}
        <ActionButton
          label={billing ? 'Pause' : 'Resume'}
          onPress={togglePause}
        />
        {subscription.status !== 'cancelled' && (
          <ActionButton label="Mark as cancelled" onPress={markCancelled} />
        )}
        <ActionButton label="Delete" destructive onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

function StatRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <Txt variant="body" color={palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="heading" color={emphasis ? palette.text : palette.textMuted}>
        {value}
      </Txt>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  accent,
  destructive,
}: {
  label: string;
  onPress: () => void;
  accent?: string;
  destructive?: boolean;
}) {
  const color = destructive ? palette.danger : (accent ?? palette.textMuted);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          borderColor: withAlpha(color, 0.35),
          backgroundColor: withAlpha(color, 0.08),
        },
        pressed && styles.pressed,
      ]}>
      <Txt variant="label" color={color}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Deliberately coarse: a 1-10 scale would demand precision nobody has. */
const USAGE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'All the time' },
];

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: 2 },

  priceCard: { gap: spacing.xs },
  price: { fontSize: 36, letterSpacing: -1.2 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },

  section: { gap: spacing.md },
  statCard: { padding: 0 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  changeCard: { gap: spacing.xs },
  usageCard: { gap: spacing.md },
  usageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  usageChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },

  actions: { gap: spacing.sm },
  actionButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  linkButton: { paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
});
