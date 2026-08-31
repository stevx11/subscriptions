import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { getBrand } from '@/data/brands';
import { sampleSubscriptions } from '@/data/sampleData';
import { useAppStore } from '@/data/store';
import { describeCycle } from '@/domain/cycle';
import { formatDateLong, formatDateShort, todayIso } from '@/domain/date';
import { formatMoney } from '@/domain/money';
import {
  daysUntilNextBilling,
  isBilling,
  nextBillingDate,
  Subscription,
} from '@/domain/subscription';
import { computeTotals } from '@/domain/totals';
import { BrandIcon } from '@/ui/BrandIcon';
import { toAccent, withAlpha } from '@/ui/color';
import { Card, Pill, Screen, SectionHeader, Txt } from '@/ui/primitives';
import { palette, radius, spacing, tint } from '@/ui/theme';

/**
 * Direction B — brand-forward.
 *
 * Every surface carries the colour of the subscription it represents, so the
 * screen is scannable by colour before you read a word of it. The interface's
 * own chrome stays almost monochrome to keep that from turning into noise, and
 * every brand colour is normalised through `toAccent` so a near-black brand and
 * a neon one land at the same visual weight.
 */
export function DashboardScreen() {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const rates = useAppStore((state) => state.rates);
  const addSubscription = useAppStore((state) => state.addSubscription);

  const today = todayIso();

  const totals = useMemo(
    () => computeTotals(subscriptions, settings.homeCurrency, rates),
    [subscriptions, settings.homeCurrency, rates],
  );

  /** Billing subscriptions, soonest charge first. */
  const upcoming = useMemo(() => {
    return subscriptions
      .filter(isBilling)
      .map((subscription) => ({
        subscription,
        date: nextBillingDate(subscription, today),
        days: daysUntilNextBilling(subscription, today) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.days - b.days);
  }, [subscriptions, today]);

  const next = upcoming[0];
  const rest = upcoming.slice(1);
  const paused = subscriptions.filter((s) => !isBilling(s));

  if (subscriptions.length === 0) {
    return (
      <Screen>
        <View style={styles.emptyWrap}>
          <Txt variant="title">Nothing tracked yet</Txt>
          <Txt variant="body" color={palette.textMuted} style={styles.emptyBody}>
            Load a realistic sample set to judge the design against mixed
            currencies, cycles and renewal dates.
          </Txt>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              for (const sample of sampleSubscriptions()) {
                addSubscription(sample);
              }
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Txt variant="label" color={palette.bg}>
              Load sample data
            </Txt>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="caption" color={palette.textFaint}>
          TOTAL EACH MONTH
        </Txt>
        <View style={styles.totalRow}>
          <Txt variant="display">{formatMoney(totals.monthly)}</Txt>
        </View>
        <Txt variant="body" color={palette.textMuted}>
          {formatMoney(totals.yearly)} a year · {totals.counted} active
        </Txt>
        {totals.unconvertible.length > 0 && (
          <View style={styles.warningRow}>
            <Pill tone="warning">
              {totals.unconvertible.join(', ')} not converted — no rate yet
            </Pill>
          </View>
        )}
      </View>

      {next && <NextUpCard entry={next} />}

      {rest.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Coming up" />
          <View style={styles.list}>
            {rest.map((entry) => (
              <UpcomingRow key={entry.subscription.id} entry={entry} />
            ))}
          </View>
        </View>
      )}

      {paused.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Not billing" />
          <View style={styles.list}>
            {paused.map((subscription) => (
              <PausedRow key={subscription.id} subscription={subscription} />
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

interface UpcomingEntry {
  subscription: Subscription;
  date: string | null;
  days: number;
}

function relativeDay(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  return `in ${Math.round(days / 7)} weeks`;
}

/**
 * The hero. Answers "what is about to take money" before anything else on the
 * screen, because that is the single question the app exists to answer.
 */
function NextUpCard({ entry }: { entry: UpcomingEntry }) {
  const { subscription, days } = entry;
  const accent = toAccent(getBrand(subscription.brandId)?.hex ?? subscription.color);
  const isTrial = subscription.status === 'trial';
  const urgent = days <= 3;

  return (
    <Card accent={accent} strength={tint.hero} style={styles.hero}>
      {/* A soft vertical falloff stops the tint reading as a flat colour block. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="heroFade" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity="0.18" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#heroFade)" />
      </Svg>

      <View style={styles.heroTop}>
        <BrandIcon brandId={subscription.brandId} name={subscription.name} size={52} />
        <View style={styles.heroLabels}>
          <Txt variant="caption" color={accent}>
            {isTrial ? 'TRIAL ENDS' : 'NEXT CHARGE'}
          </Txt>
          <Txt variant="title" numberOfLines={1}>
            {subscription.name}
          </Txt>
        </View>
        <View style={styles.heroUrgency}>
          <Pill accent={urgent ? palette.warning : accent} tone={urgent ? 'warning' : 'accent'}>
            {relativeDay(days)}
          </Pill>
        </View>
      </View>

      <View style={styles.heroBottom}>
        <View style={styles.heroAmountBlock}>
          <Txt variant="display" style={styles.heroAmount}>
            {formatMoney(subscription.price)}
          </Txt>
          <Txt variant="label" color={palette.textMuted}>
            {describeCycle(subscription.cycle)}
          </Txt>
        </View>
        <View style={styles.heroWhen}>
          <Pill accent={urgent ? palette.warning : accent} tone={urgent ? 'warning' : 'accent'}>
            {relativeDay(days)}
          </Pill>
          {entry.date && (
            <Txt variant="heading" style={styles.heroDate} numberOfLines={1}>
              {formatDateLong(entry.date)}
            </Txt>
          )}
        </View>
      </View>
    </Card>
  );
}

function UpcomingRow({ entry }: { entry: UpcomingEntry }) {
  const { subscription, days } = entry;
  const accent = toAccent(getBrand(subscription.brandId)?.hex ?? subscription.color);

  return (
    <Card accent={accent} style={styles.row}>
      {/* A colour bar on the leading edge makes the list scannable at a glance
          without every card becoming a saturated block. */}
      <View style={[styles.edge, { backgroundColor: accent }]} />
      <BrandIcon brandId={subscription.brandId} name={subscription.name} size={40} />

      <View style={styles.rowText}>
        <Txt variant="heading" numberOfLines={1}>
          {subscription.name}
        </Txt>
        <Txt variant="label" color={palette.textFaint}>
          {entry.date ? formatDateShort(entry.date) : describeCycle(subscription.cycle)} ·{' '}
          {relativeDay(days)}
        </Txt>
      </View>

      <View style={styles.rowRight}>
        <Txt variant="heading">{formatMoney(subscription.price)}</Txt>
        {subscription.status === 'trial' && (
          <Txt variant="caption" color={palette.warning}>
            TRIAL
          </Txt>
        )}
      </View>
    </Card>
  );
}

function PausedRow({ subscription }: { subscription: Subscription }) {
  return (
    <Card style={[styles.row, styles.pausedRow]}>
      <View style={styles.dimmed}>
        <BrandIcon brandId={subscription.brandId} name={subscription.name} size={40} />
      </View>
      <View style={styles.rowText}>
        <Txt variant="heading" color={palette.textMuted} numberOfLines={1}>
          {subscription.name}
        </Txt>
        <Txt variant="label" color={palette.textFaint}>
          {subscription.status === 'paused' ? 'Paused' : 'Cancelled'} · not counted
        </Txt>
      </View>
      <Txt variant="heading" color={palette.textFaint}>
        {formatMoney(subscription.price)}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingTop: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end' },
  warningRow: { marginTop: spacing.sm },

  section: { gap: spacing.md },
  list: { gap: spacing.sm + 2 },

  hero: { gap: spacing.xl, paddingVertical: spacing.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroLabels: { flex: 1, gap: 2 },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroAmount: { fontSize: 34, letterSpacing: -1 },
  heroAmountBlock: { flexShrink: 1 },
  heroWhen: { alignItems: 'flex-end', flexShrink: 0 },
  // Pinned to the top edge rather than centred with the logo, so it reads as a
  // corner badge on the card instead of a label attached to the name.
  heroUrgency: { alignSelf: 'flex-start', flexShrink: 0 },
  // The date is the payload of this card — when the money actually leaves —
  // so it gets full-strength text, not the muted treatment of a caption.
  heroDate: { fontSize: 19, letterSpacing: -0.3 },

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
  rowRight: { alignItems: 'flex-end', gap: 3 },
  pausedRow: { backgroundColor: withAlpha(palette.surface, 0.6) },
  dimmed: { opacity: 0.45 },

  emptyWrap: { paddingTop: spacing.xxxl * 2, gap: spacing.md, alignItems: 'flex-start' },
  emptyBody: { lineHeight: 21 },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: palette.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.7 },
});
