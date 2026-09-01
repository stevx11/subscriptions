import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { formatDateLong } from '@/domain/date';
import { Card, Txt } from '@/ui/primitives';
import { palette, spacing } from '@/ui/theme';
import { RemindersState } from './useReminders';

/**
 * The reminders control on the dashboard.
 *
 * Reminders are off by default and turned on from here, because iOS shows the
 * permission prompt exactly once per install: firing it on launch, before the
 * user knows what the app does, risks a permanent denial that cannot be undone
 * from inside the app.
 *
 * Full controls (lead time, hour of day) land in Settings in Phase 9.
 */
export function RemindersCard({ state }: { state: RemindersState }) {
  const { permitted, enabled, plans, enable, disable } = state;
  const next = plans[0];

  if (!enabled) {
    return (
      <Card style={styles.card}>
        <Txt variant="caption" color={palette.textFaint}>
          REMINDERS
        </Txt>
        <Txt variant="body" color={palette.textMuted} style={styles.body}>
          Get a notification a couple of days before anything charges you.
        </Txt>
        <Pressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await enable();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Txt variant="label" color={palette.bg}>
            Turn on reminders
          </Txt>
        </Pressable>
      </Card>
    );
  }

  // Enabled in the app but denied at the OS level: nothing can fire, and the
  // only fix is in iOS Settings, so say so rather than pretending it works.
  if (!permitted) {
    return (
      <Card accent={palette.warning} strength={0.1} style={styles.card}>
        <Txt variant="caption" color={palette.warning}>
          REMINDERS BLOCKED
        </Txt>
        <Txt variant="body" color={palette.textMuted} style={styles.body}>
          Notifications are turned off for this app in iOS Settings, so nothing
          can be scheduled.
        </Txt>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Txt variant="label" color={palette.bg}>
            Open iOS Settings
          </Txt>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Txt variant="caption" color={palette.positive}>
          REMINDERS ON
        </Txt>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            disable();
          }}
          hitSlop={10}>
          <Txt variant="label" color={palette.textFaint}>
            Turn off
          </Txt>
        </Pressable>
      </View>
      <Txt variant="body" color={palette.textMuted}>
        {next
          ? `Next alert ${formatDateLong(next.fireOn)} — ${next.title.toLowerCase()}`
          : 'Nothing to warn you about yet.'}
      </Txt>
      {plans.length > 1 && (
        <Txt variant="label" color={palette.textFaint}>
          {plans.length} reminders queued
        </Txt>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: { lineHeight: 21 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: palette.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.7 },
});
