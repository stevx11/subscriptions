import { StyleSheet, View } from 'react-native';

import { formatMoney, Money, toDecimal } from '@/domain/money';
import { withAlpha } from './color';
import { fonts } from './fonts';
import { Txt } from './primitives';
import { palette, radius, spacing } from './theme';

/**
 * Charts, built from views rather than an SVG chart library.
 *
 * Both charts here are **single-series**: bar length carries the magnitude and
 * the labels carry identity, so colour encodes nothing. That is deliberate —
 * it removes any categorical-palette colourblindness problem, and it avoids the
 * trap of ramping colour by rank, which repaints the surviving bars whenever a
 * filter changes the ordering.
 *
 * Because there is one series, no legend is needed: the title names it.
 */

/** Bars sit on a fixed baseline with rounded data-ends. */
const BAR_RADIUS = 4;

export interface ColumnDatum {
  label: string;
  value: Money;
  /** Rendered hollow — a projection, not a settled figure. */
  muted?: boolean;
  /** Draws attention to one column, e.g. the current month. */
  highlighted?: boolean;
}

/**
 * A vertical column chart for a time series.
 *
 * Columns rather than a line because the underlying data is discrete: money
 * moves on specific days, and a line would imply a continuous quantity flowing
 * between months.
 */
export function ColumnChart({
  data,
  height = 132,
}: {
  data: readonly ColumnDatum[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value.amount), 1);

  return (
    <View>
      <View style={[styles.columns, { height }]}>
        {data.map((datum, index) => {
          // A zero-value month still needs a visible foot, or the axis reads as
          // a gap in the data rather than a month with no charges.
          const ratio = datum.value.amount / max;
          const barHeight = Math.max(2, ratio * (height - 4));

          return (
            <View key={`${datum.label}-${index}`} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: datum.muted
                      ? withAlpha(palette.chart, 0.28)
                      : palette.chart,
                  },
                  datum.highlighted && styles.barHighlighted,
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.axis}>
        {data.map((datum, index) => (
          <View key={`${datum.label}-label-${index}`} style={styles.column}>
            <Txt
              variant="caption"
              color={datum.highlighted ? palette.text : palette.textFaint}>
              {datum.label}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export interface BarDatum {
  label: string;
  value: Money;
  /** 0-1. Supplied rather than derived so the caller decides the denominator. */
  share: number;
  meta?: string;
}

/**
 * Horizontal bars for comparing named categories.
 *
 * Horizontal rather than a pie or donut: comparing lengths against a shared
 * baseline is far more accurate than comparing angles, and category names fit
 * on one line instead of needing a legend.
 *
 * Every bar is directly labelled with its value. With six or fewer rows that is
 * clearer than any tooltip, and on a touch screen there is no hover anyway.
 */
export function BarList({ data }: { data: readonly BarDatum[] }) {
  const max = Math.max(...data.map((d) => d.value.amount), 1);

  return (
    <View style={styles.barList}>
      {data.map((datum, index) => (
        <View key={`${datum.label}-${index}`} style={styles.barRow}>
          <View style={styles.barLabels}>
            <Txt variant="label" numberOfLines={1}>
              {datum.label}
            </Txt>
            <View style={styles.barValues}>
              {datum.meta && (
                <Txt variant="caption" color={palette.textFaint}>
                  {datum.meta}
                </Txt>
              )}
              <Txt variant="label" color={palette.textMuted}>
                {formatMoney(datum.value)}
              </Txt>
            </View>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${Math.max(1.5, (datum.value.amount / max) * 100)}%` },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * A single headline figure.
 *
 * Sometimes the honest answer is not a chart: one number with a label reads
 * faster than any plot of one value.
 */
export function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'warning' | 'positive';
}) {
  const color =
    tone === 'warning'
      ? palette.warning
      : tone === 'positive'
        ? palette.positive
        : palette.text;

  return (
    <View style={styles.tile}>
      <Txt variant="caption" color={palette.textFaint}>
        {label.toUpperCase()}
      </Txt>
      <Txt variant="title" color={color} style={styles.tileValue}>
        {value}
      </Txt>
      {caption && (
        <Txt variant="label" color={palette.textFaint}>
          {caption}
        </Txt>
      )}
    </View>
  );
}

/** Convenience for callers that need the numeric value for a label. */
export function moneyToNumber(value: Money): number {
  return toDecimal(value);
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  column: { flex: 1, alignItems: 'center' },
  bar: {
    width: '78%',
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
  },
  barHighlighted: {
    borderWidth: 1,
    borderColor: palette.text,
  },
  axis: { flexDirection: 'row', gap: 2, marginTop: spacing.sm },

  barList: { gap: spacing.md },
  barRow: { gap: 6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  barValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    height: 8,
    backgroundColor: palette.border,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: palette.chart,
    borderRadius: BAR_RADIUS,
  },

  tile: {
    flex: 1,
    gap: 2,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileValue: { fontFamily: fonts.displayBold },
});
