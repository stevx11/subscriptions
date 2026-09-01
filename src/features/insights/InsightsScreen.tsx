import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { getBrand } from '@/data/brands';
import { useAppStore } from '@/data/store';
import { formatDateLong, formatMonthShort, startOfMonth, todayIso } from '@/domain/date';
import { formatMoney } from '@/domain/money';
import { isBilling } from '@/domain/subscription';
import { computeTotals } from '@/domain/totals';
import { BrandIcon } from '@/ui/BrandIcon';
import { BarList, ColumnChart, StatTile } from '@/ui/charts';
import { toAccent } from '@/ui/color';
import { Card, Screen, SectionHeader, Txt } from '@/ui/primitives';
import { palette, spacing } from '@/ui/theme';
import {
  categoryBreakdown,
  monthlySpend,
  mostExpensive,
  priceRises,
  rarelyUsed,
} from './insights';

/**
 * Where the money actually goes.
 *
 * Every section here has to earn its place by telling the user something they
 * could not read off the other two tabs — so it leads with the yearly figure
 * (which nobody computes in their head), then the shape of spending over time,
 * then the specific things worth cancelling.
 */
export function InsightsScreen() {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const rates = useAppStore((state) => state.rates);

  const today = todayIso();
  const currency = settings.homeCurrency;

  const totals = useMemo(
    () => computeTotals(subscriptions, currency, rates),
    [subscriptions, currency, rates],
  );
  const months = useMemo(
    () => monthlySpend(subscriptions, currency, rates, today),
    [subscriptions, currency, rates, today],
  );
  const categories = useMemo(
    () => categoryBreakdown(subscriptions, currency, rates),
    [subscriptions, currency, rates],
  );
  const expensive = useMemo(
    () => mostExpensive(subscriptions, currency, rates),
    [subscriptions, currency, rates],
  );
  const rises = useMemo(() => priceRises(subscriptions), [subscriptions]);
  const unused = useMemo(
    () => rarelyUsed(subscriptions, currency, rates),
    [subscriptions, currency, rates],
  );

  const billingCount = subscriptions.filter(isBilling).length;

  if (billingCount === 0) {
    return (
      <Screen>
        <Txt variant="title">Insights</Txt>
        <Txt variant="body" color={palette.textMuted}>
          Add a few subscriptions and this fills in with where your money goes.
        </Txt>
      </Screen>
    );
  }

  const currentMonth = startOfMonth(today);
  const busiest = months.reduce((max, point) =>
    point.total.amount > max.total.amount ? point : max,
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="caption" color={palette.textFaint}>
          EVERY YEAR
        </Txt>
        <Txt variant="display">{formatMoney(totals.yearly)}</Txt>
        <Txt variant="body" color={palette.textMuted}>
          across {billingCount} active {billingCount === 1 ? 'subscription' : 'subscriptions'}
        </Txt>
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Busiest month"
          value={formatMoney(busiest.total)}
          caption={formatMonthShort(busiest.month)}
        />
        <StatTile
          label="Price rises"
          value={String(rises.length)}
          caption={rises.length === 0 ? 'none detected' : 'since you started tracking'}
          tone={rises.length > 0 ? 'warning' : 'default'}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Charges by month" />
        <Card>
          <ColumnChart
            data={months.map((point) => ({
              label: formatMonthShort(point.month),
              value: point.total,
              muted: point.projected,
              highlighted: point.month === currentMonth,
            }))}
          />
          <Txt variant="label" color={palette.textFaint} style={styles.chartNote}>
            Solid bars are months already billed; faded bars are scheduled ahead.
            A yearly plan shows as one tall month, which is how it actually hits
            your account.
          </Txt>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Where it goes" />
        <Card>
          <BarList
            data={categories.map((entry) => ({
              label: entry.category,
              value: entry.monthly,
              share: entry.share,
              meta: `${Math.round(entry.share * 100)}%`,
            }))}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Costs you most" />
        <View style={styles.list}>
          {expensive.map((entry) => (
            <Card
              key={entry.subscription.id}
              accent={toAccent(
                getBrand(entry.subscription.brandId)?.hex ?? entry.subscription.color,
              )}
              style={styles.row}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/subscription/[id]',
                  params: { id: entry.subscription.id },
                });
              }}>
              <BrandIcon
                brandId={entry.subscription.brandId}
                name={entry.subscription.name}
                size={36}
              />
              <View style={styles.rowText}>
                <Txt variant="heading" numberOfLines={1}>
                  {entry.subscription.name}
                </Txt>
                <Txt variant="label" color={palette.textFaint}>
                  {Math.round(entry.share * 100)}% of your yearly spend
                </Txt>
              </View>
              <Txt variant="heading">{formatMoney(entry.yearly)}</Txt>
            </Card>
          ))}
        </View>
      </View>

      {rises.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Went up in price" />
          <View style={styles.list}>
            {rises.map((rise) => (
              <Card key={rise.subscription.id} accent={palette.warning} strength={0.1} style={styles.row}>
                <BrandIcon
                  brandId={rise.subscription.brandId}
                  name={rise.subscription.name}
                  size={36}
                />
                <View style={styles.rowText}>
                  <Txt variant="heading" numberOfLines={1}>
                    {rise.subscription.name}
                  </Txt>
                  <Txt variant="label" color={palette.textFaint}>
                    {formatMoney(rise.from)} → {formatMoney(rise.to)} ·{' '}
                    {formatDateLong(rise.since, today)}
                  </Txt>
                </View>
                <Txt variant="heading" color={palette.warning}>
                  +{Math.round(rise.fraction * 100)}%
                </Txt>
              </Card>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Barely used" />
        {unused.length === 0 ? (
          <Card>
            <Txt variant="body" color={palette.textMuted} style={styles.emptyNote}>
              Nothing marked as unused yet. Open any subscription and rate how
              much you actually use it — anything you rate low shows up here with
              what it costs a year.
            </Txt>
          </Card>
        ) : (
          <View style={styles.list}>
            {unused.map((entry) => (
              <Card
                key={entry.subscription.id}
                accent={palette.danger}
                strength={0.1}
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/subscription/[id]',
                    params: { id: entry.subscription.id },
                  })
                }>
                <BrandIcon
                  brandId={entry.subscription.brandId}
                  name={entry.subscription.name}
                  size={36}
                />
                <View style={styles.rowText}>
                  <Txt variant="heading" numberOfLines={1}>
                    {entry.subscription.name}
                  </Txt>
                  <Txt variant="label" color={palette.textFaint}>
                    Cancelling saves this every year
                  </Txt>
                </View>
                <Txt variant="heading" color={palette.danger}>
                  {formatMoney(entry.yearly)}
                </Txt>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.md },
  list: { gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowText: { flex: 1, gap: 1 },
  chartNote: { marginTop: spacing.md, lineHeight: 17 },
  emptyNote: { lineHeight: 21 },
});
