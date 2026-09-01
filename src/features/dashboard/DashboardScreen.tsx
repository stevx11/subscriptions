import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { getBrand } from '@/data/brands';
import { sampleSubscriptions } from '@/data/sampleData';
import { useAppStore } from '@/data/store';
import { useRates } from '@/data/useRates';
import { describeCycle } from '@/domain/cycle';
import {
  addDays,
  endOfMonth,
  formatDateLong,
  formatDateShort,
  todayIso,
} from '@/domain/date';
import { rateAgeHours } from '@/domain/fx';
import { formatMoney } from '@/domain/money';
import {
  daysUntilNextBilling,
  isBilling,
  nextBillingDate,
  Subscription,
} from '@/domain/subscription';
import { chargesBetween, computeTotals } from '@/domain/totals';
import { BrandIcon } from '@/ui/BrandIcon';
import { toAccent, withAlpha } from '@/ui/color';
import { Card, Pill, Screen, SectionHeader, Txt } from '@/ui/primitives';
import { fonts } from '@/ui/fonts';
import { palette, radius, spacing, tint } from '@/ui/theme';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { useReminders } from '@/features/reminders/useReminders';
import { groupUpcoming } from './grouping';

/** How far ahead the timeline strip looks. */
const TIMELINE_DAYS = 30;

interface UpcomingEntry {
  subscription: Subscription;
  date: string | null;
  days: number;
}

/**
 * The home screen.
 *
 * Ordered by the question it answers: what is still leaving the account this
 * month, then what charges next, then the running averages. A trial about to
 * convert jumps above all of it, because that is the charge people are
 * actually surprised by.
 *
 * The headline is deliberately "left to pay this month" rather than the
 * monthly average. An average is a planning number; the amount still queued up
 * this month is the one that decides whether you can spend money today.
 */
export function DashboardScreen() {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const rates = useAppStore((state) => state.rates);
  const addSubscription = useAppStore((state) => state.addSubscription);
  const rateStatus = useRates();
  const reminders = useReminders();

  const today = todayIso();

  const totals = useMemo(
    () => computeTotals(subscriptions, settings.homeCurrency, rates),
    [subscriptions, settings.homeCurrency, rates],
  );

  const remaining = useMemo(
    () =>
      chargesBetween(subscriptions, settings.homeCurrency, rates, today, endOfMonth(today)),
    [subscriptions, settings.homeCurrency, rates, today],
  );

  const upcoming = useMemo<UpcomingEntry[]>(
    () =>
      subscriptions
        .filter(isBilling)
        .map((subscription) => ({
          subscription,
          date: nextBillingDate(subscription, today),
          days: daysUntilNextBilling(subscription, today) ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => a.days - b.days),
    [subscriptions, today],
  );

  const next = upcoming[0];
  const rest = useMemo(() => groupUpcoming(upcoming.slice(1), today), [upcoming, today]);
  const paused = subscriptions.filter((s) => !isBilling(s));

  /** Trials converting within a week deserve to interrupt. */
  const convertingTrials = upcoming.filter(
    (entry) => entry.subscription.status === 'trial' && entry.days <= 7,
  );

  if (subscriptions.length === 0) {
    return (
      <EmptyState onAddSamples={() => sampleSubscriptions().forEach(addSubscription)} />
    );
  }

  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.header}>
          <Txt variant="caption" color={palette.textFaint}>
            LEFT TO PAY THIS MONTH
          </Txt>
          <Txt variant="display">{formatMoney(remaining.total)}</Txt>
          <Txt variant="body" color={palette.textMuted}>
            {remaining.count === 0
              ? 'Nothing else due this month'
              : `${remaining.count} ${remaining.count === 1 ? 'charge' : 'charges'} before ${formatDateShort(endOfMonth(today))}`}
          </Txt>

          <View style={styles.averages}>
            <Stat label="Monthly average" value={formatMoney(totals.monthly)} />
            <Stat label="Per year" value={formatMoney(totals.yearly)} />
            <Stat label="Active" value={String(totals.counted)} />
          </View>

          <RateNotice
            status={rateStatus}
            unconvertible={totals.unconvertible}
            ageHours={rates ? rateAgeHours(rates) : null}
          />
        </View>

        {convertingTrials.length > 0 && <TrialWarning entries={convertingTrials} />}

        <RemindersCard state={reminders} />

        {next && <NextUpCard entry={next} />}

        <Timeline entries={upcoming} today={today} />

        {rest.map((group) => (
          <View key={group.id} style={styles.section}>
            <SectionHeader title={group.label} />
            <View style={styles.list}>
              {group.entries.map((entry) => (
                <UpcomingRow key={entry.subscription.id} entry={entry} />
              ))}
            </View>
          </View>
        ))}

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
      <AddButton />
    </View>
  );
}

function accentFor(subscription: Subscription): string {
  return toAccent(getBrand(subscription.brandId)?.hex ?? subscription.color);
}

function openDetail(id: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push({ pathname: '/subscription/[id]', params: { id } });
}

function relativeDay(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  return `in ${Math.round(days / 7)} weeks`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color={palette.textFaint}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}

/**
 * Says plainly when the totals rest on missing or stale rates. A figure that is
 * quietly wrong is worse than one labelled as dated.
 */
function RateNotice({
  status,
  unconvertible,
  ageHours,
}: {
  status: string;
  unconvertible: string[];
  ageHours: number | null;
}) {
  if (unconvertible.length > 0) {
    return (
      <View style={styles.notice}>
        <Pill tone="warning">
          {unconvertible.join(', ')} not included — no exchange rate yet
        </Pill>
      </View>
    );
  }
  if (status === 'offline' && ageHours !== null && ageHours > 48) {
    return (
      <View style={styles.notice}>
        <Pill tone="neutral">Rates are {Math.round(ageHours / 24)} days old — offline</Pill>
      </View>
    );
  }
  return null;
}

function TrialWarning({ entries }: { entries: UpcomingEntry[] }) {
  return (
    <Card accent={palette.warning} strength={0.12} style={styles.trialCard}>
      <Txt variant="caption" color={palette.warning}>
        {entries.length === 1
          ? 'A TRIAL IS ABOUT TO CHARGE YOU'
          : 'TRIALS ABOUT TO CHARGE YOU'}
      </Txt>
      {entries.map(({ subscription, days }) => (
        <Pressable
          key={subscription.id}
          onPress={() => openDetail(subscription.id)}
          style={styles.trialRow}>
          <BrandIcon brandId={subscription.brandId} name={subscription.name} size={32} />
          <Txt variant="heading" style={styles.trialName} numberOfLines={1}>
            {subscription.name}
          </Txt>
          <Txt variant="label" color={palette.warning}>
            {formatMoney(subscription.price)} {relativeDay(days)}
          </Txt>
        </Pressable>
      ))}
    </Card>
  );
}

function NextUpCard({ entry }: { entry: UpcomingEntry }) {
  const { subscription, days } = entry;
  const accent = accentFor(subscription);
  const isTrial = subscription.status === 'trial';
  const urgent = days <= 3;

  return (
    <Card
      accent={accent}
      strength={tint.hero}
      style={styles.hero}
      onPress={() => openDetail(subscription.id)}>
      {/* A soft falloff stops the tint reading as a flat colour block. */}
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
          <Pill
            accent={urgent ? palette.warning : accent}
            tone={urgent ? 'warning' : 'accent'}>
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

/**
 * A month at a glance: one dot per upcoming charge, positioned by how far away
 * it is. Turns "when does my spending cluster" into something visible rather
 * than something you reconstruct from a list of dates.
 */
function Timeline({ entries, today }: { entries: UpcomingEntry[]; today: string }) {
  const visible = entries.filter((entry) => entry.days >= 0 && entry.days <= TIMELINE_DAYS);
  if (visible.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader title={`Next ${TIMELINE_DAYS} days`} />
      <View style={styles.timeline}>
        <View style={styles.timelineTrack} />
        {visible.map((entry) => (
          <View
            key={entry.subscription.id}
            style={[
              styles.timelineDot,
              {
                left: `${(entry.days / TIMELINE_DAYS) * 100}%`,
                backgroundColor: accentFor(entry.subscription),
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.timelineLabels}>
        <Txt variant="caption" color={palette.textFaint}>
          TODAY
        </Txt>
        <Txt variant="caption" color={palette.textFaint}>
          {formatDateShort(addDays(today, TIMELINE_DAYS)).toUpperCase()}
        </Txt>
      </View>
    </View>
  );
}

function UpcomingRow({ entry }: { entry: UpcomingEntry }) {
  const { subscription, days } = entry;
  const accent = accentFor(subscription);

  return (
    <Card accent={accent} style={styles.row} onPress={() => openDetail(subscription.id)}>
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
    <Card style={[styles.row, styles.pausedRow]} onPress={() => openDetail(subscription.id)}>
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

function EmptyState({ onAddSamples }: { onAddSamples: () => void }) {
  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.emptyWrap}>
          <Txt variant="title">Nothing tracked yet</Txt>
          <Txt variant="body" color={palette.textMuted} style={styles.emptyBody}>
            Add what you actually pay for and this becomes a running answer to
            &ldquo;what is about to charge me&rdquo;.
          </Txt>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add');
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Txt variant="label" color={palette.bg}>
              Add a subscription
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAddSamples();
            }}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Txt variant="label" color={palette.textFaint}>
              Or load sample data
            </Txt>
          </Pressable>
        </View>
      </Screen>
    </View>
  );
}

function AddButton() {
  return (
    <Pressable
      accessibilityLabel="Add subscription"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/add');
      }}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
      <Txt variant="title" color={palette.bg} style={styles.fabPlus}>
        +
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 2, paddingTop: spacing.sm },
  averages: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  stat: { gap: 2 },
  notice: { marginTop: spacing.md },

  section: { gap: spacing.md },
  list: { gap: spacing.sm + 2 },

  trialCard: { gap: spacing.sm },
  trialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trialName: { flex: 1 },

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
  heroUrgency: { alignSelf: 'flex-start', flexShrink: 0 },
  heroDate: { fontSize: 19, letterSpacing: -0.3 },

  timeline: { height: 22, justifyContent: 'center' },
  timelineTrack: { height: 2, backgroundColor: palette.border, borderRadius: 1 },
  timelineDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: palette.bg,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },

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
  textButton: { paddingVertical: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
  fabPlus: { fontSize: 30, lineHeight: 34, fontFamily: fonts.bodyMedium },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: palette.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.7 },
});
