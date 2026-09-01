import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  addMonths,
  compareIsoDate,
  dayOfWeekMonday0,
  daysInMonth,
  formatIsoDate,
  formatMonthLabel,
  IsoDate,
  parseIsoDate,
  startOfMonth,
  todayIso,
} from '@/domain/date';
import { fonts } from './fonts';
import { palette, radius, spacing } from './theme';
import { withAlpha } from './color';

/**
 * A month grid built on the domain's own date maths.
 *
 * Deliberately not the native picker: the iOS wheel looks foreign inside a
 * custom dark interface, and a spinner is a poor way to answer "which day of
 * this month" when the answer is almost always visible in a grid. Building it
 * here also means it reuses the same clamping and leap-year logic the billing
 * engine uses, rather than a second implementation that can disagree.
 *
 * Weeks start on Monday.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface CalendarProps {
  value: IsoDate;
  onChange: (date: IsoDate) => void;
  /** Dates before this are shown but not selectable. */
  minDate?: IsoDate;
  accent?: string;
}

export function Calendar({ value, onChange, minDate, accent = palette.text }: CalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState<IsoDate>(() => startOfMonth(value));
  const today = todayIso();

  const cells = useMemo(() => {
    const { year, month } = parseIsoDate(visibleMonth);
    const leading = dayOfWeekMonday0(visibleMonth);
    const total = daysInMonth(year, month);

    const result: (IsoDate | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= total; day += 1) {
      result.push(formatIsoDate({ year, month, day }));
    }
    return result;
  }, [visibleMonth]);

  const step = (months: number) => {
    Haptics.selectionAsync();
    setVisibleMonth(startOfMonth(addMonths(visibleMonth, months)));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <NavButton label="‹" onPress={() => step(-1)} />
        <Text style={styles.monthLabel}>{formatMonthLabel(visibleMonth)}</Text>
        <NavButton label="›" onPress={() => step(1)} />
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (date === null) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }
          const selected = date === value;
          const isToday = date === today;
          const disabled = minDate !== undefined && compareIsoDate(date, minDate) < 0;

          return (
            <Pressable
              key={date}
              disabled={disabled}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(date);
              }}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  selected && { backgroundColor: accent },
                  !selected && isToday && { borderColor: withAlpha(accent, 0.5), borderWidth: 1 },
                ]}>
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayDisabled,
                    selected && styles.daySelected,
                  ]}>
                  {parseIsoDate(date).day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.nav, pressed && styles.navPressed]}>
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  monthLabel: { color: palette.text, fontSize: 16, fontFamily: fonts.displayBold },
  nav: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  navPressed: { backgroundColor: palette.surfaceRaised },
  navLabel: { color: palette.text, fontSize: 20, lineHeight: 22, fontFamily: fonts.bodySemibold },

  weekdays: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: palette.textFaint,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { color: palette.text, fontSize: 15, fontFamily: fonts.displayMedium },
  daySelected: { color: palette.bg, fontFamily: fonts.displayBold },
  dayDisabled: { color: palette.textFaint, opacity: 0.4 },
});
