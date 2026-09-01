import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
// expo-file-system 19 replaced the old readAsStringAsync/cacheDirectory API
// with File/Paths objects whose read and write are synchronous.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { sampleSubscriptions } from '@/data/sampleData';
import { useAppStore } from '@/data/store';
import { fetchRateTable } from '@/data/rates';
import { CURRENCIES, CurrencyCode } from '@/domain/currency';
import { rateAgeHours } from '@/domain/fx';
import { Card, Divider, Screen, SectionHeader, Txt } from '@/ui/primitives';
import { withAlpha } from '@/ui/color';
import { palette, radius, spacing } from '@/ui/theme';
import { useReminders } from '@/features/reminders/useReminders';
import {
  backupFileName,
  BackupError,
  describeBackup,
  exportBackup,
  parseBackup,
} from './backup';

const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7];
const HOUR_OPTIONS = [7, 9, 12, 18, 20];

/**
 * Settings, and — more importantly — the escape hatch.
 *
 * The backup section is the reason this screen matters. A sideloaded app
 * re-signed with a free Apple ID can lose its storage when a refresh fails, and
 * there is no server holding a copy. Export is the only recovery path there is.
 */
export function SettingsScreen() {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const rates = useAppStore((state) => state.rates);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setRates = useAppStore((state) => state.setRates);
  const replaceAll = useAppStore((state) => state.replaceAll);
  const addSubscription = useAppStore((state) => state.addSubscription);

  const reminders = useReminders();

  const [showCurrencies, setShowCurrencies] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const currency = CURRENCIES.find((c) => c.code === settings.homeCurrency);

  const refreshRates = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy('rates');
    const table = await fetchRateTable(settings.homeCurrency);
    setBusy(null);
    if (table) {
      setRates(table);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Could not refresh', 'No connection, or the rates service is down. Your existing rates are unchanged.');
    }
  };

  const doExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setBusy('export');
      const contents = exportBackup(subscriptions, settings);
      const file = new File(Paths.cache, backupFileName());
      // Overwrite rather than fail when exporting twice in one day.
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(contents);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save your subscriptions backup',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Backup written', `Saved to ${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', String(error));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }

      setBusy('import');
      const contents = await new File(picked.assets[0].uri).text();
      const restored = parseBackup(contents);
      setBusy(null);

      // Restoring replaces everything, so it confirms with what is in the file
      // and what is about to be lost.
      Alert.alert(
        'Restore this backup?',
        `${describeBackup(restored)}\n\nThis replaces the ${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'} currently in the app.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              replaceAll(restored.subscriptions, restored.settings);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (restored.skipped.length > 0) {
                Alert.alert(
                  'Restored with some entries skipped',
                  restored.skipped.join('\n'),
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      setBusy(null);
      Alert.alert(
        'Could not read that file',
        error instanceof BackupError ? error.message : String(error),
      );
    }
  };

  const clearAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete everything?',
      'Every subscription and its history is removed. Export a backup first if you might want any of it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => replaceAll([]),
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">Settings</Txt>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Money" />
        <Card style={styles.rows}>
          <Row
            label="Home currency"
            value={currency ? `${currency.code} · ${currency.name}` : settings.homeCurrency}
            onPress={() => setShowCurrencies(true)}
          />
          <Divider />
          <Row
            label="Exchange rates"
            value={
              rates
                ? rateAgeHours(rates) < 1
                  ? 'Updated just now'
                  : `Updated ${Math.round(rateAgeHours(rates))}h ago`
                : 'Never fetched'
            }
            action={busy === 'rates' ? 'Refreshing…' : 'Refresh'}
            onPress={refreshRates}
          />
        </Card>
        <Txt variant="label" color={palette.textFaint} style={styles.note}>
          Each subscription keeps its own currency. This is only what the totals
          are shown in, so changing it never alters what you entered.
        </Txt>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Reminders" />
        <Card style={styles.rows}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Txt variant="body">Renewal reminders</Txt>
              <Txt variant="label" color={palette.textFaint}>
                {reminders.enabled && reminders.permitted
                  ? `${reminders.plans.length} queued`
                  : 'Off'}
              </Txt>
            </View>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={async (next) => {
                Haptics.selectionAsync();
                if (next) {
                  await reminders.enable();
                } else {
                  reminders.disable();
                }
              }}
              trackColor={{ false: palette.border, true: withAlpha(palette.positive, 0.5) }}
              thumbColor={settings.remindersEnabled ? palette.positive : palette.textFaint}
            />
          </View>

          {settings.remindersEnabled && (
            <>
              <Divider />
              <ChipRow
                label="Warn me"
                options={REMINDER_DAY_OPTIONS.map((days) => ({
                  key: String(days),
                  label:
                    days === 0 ? 'Same day' : days === 1 ? '1 day' : `${days} days`,
                  active: settings.defaultReminderDays === days,
                  onPress: () => updateSettings({ defaultReminderDays: days }),
                }))}
              />
              <Divider />
              <ChipRow
                label="At"
                options={HOUR_OPTIONS.map((hour) => ({
                  key: String(hour),
                  label: `${String(hour).padStart(2, '0')}:00`,
                  active: settings.reminderHour === hour,
                  onPress: () => updateSettings({ reminderHour: hour }),
                }))}
              />
            </>
          )}
        </Card>
        <Txt variant="label" color={palette.textFaint} style={styles.note}>
          Individual subscriptions can override this from their edit screen.
        </Txt>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Backup" />
        <Card style={styles.rows}>
          <Row
            label="Export a backup"
            value={`${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'}`}
            action={busy === 'export' ? 'Working…' : 'Export'}
            onPress={doExport}
          />
          <Divider />
          <Row
            label="Restore from a backup"
            value="Replaces everything in the app"
            action={busy === 'import' ? 'Reading…' : 'Restore'}
            onPress={doImport}
          />
        </Card>
        <Txt variant="label" color={palette.textFaint} style={styles.note}>
          Worth doing occasionally. This app stores everything on the phone with
          no server behind it, and a sideloaded app can lose its data if a
          signing refresh fails.
        </Txt>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Data" />
        <Card style={styles.rows}>
          <Row
            label="Load sample data"
            value="Ten example subscriptions"
            action="Load"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              sampleSubscriptions().forEach(addSubscription);
            }}
          />
          <Divider />
          <Row label="Delete everything" value="" action="Delete" destructive onPress={clearAll} />
        </Card>
      </View>

      <Txt variant="label" color={palette.textFaint} style={styles.footer}>
        Subscriptions · all data stays on this device
      </Txt>

      <Modal
        visible={showCurrencies}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencies(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCurrencies(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Txt variant="heading">Show totals in</Txt>
            <ScrollView style={styles.sheetList}>
              {CURRENCIES.map((option) => {
                const active = option.code === settings.homeCurrency;
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      Haptics.selectionAsync();
                      updateSettings({ homeCurrency: option.code as CurrencyCode });
                      setShowCurrencies(false);
                    }}
                    style={({ pressed }) => [styles.currencyRow, pressed && styles.pressed]}>
                    <Txt variant="heading" color={active ? palette.positive : palette.text}>
                      {option.symbol}
                    </Txt>
                    <View style={styles.currencyText}>
                      <Txt variant="body">{option.code}</Txt>
                      <Txt variant="label" color={palette.textFaint}>
                        {option.name}
                      </Txt>
                    </View>
                    {active && (
                      <Txt variant="label" color={palette.positive}>
                        ✓
                      </Txt>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Row({
  label,
  value,
  action,
  destructive,
  onPress,
}: {
  label: string;
  value: string;
  action?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Txt variant="body" color={destructive ? palette.danger : palette.text}>
          {label}
        </Txt>
        {value !== '' && (
          <Txt variant="label" color={palette.textFaint}>
            {value}
          </Txt>
        )}
      </View>
      <Txt variant="label" color={destructive ? palette.danger : palette.textMuted}>
        {action ?? '›'}
      </Txt>
    </Pressable>
  );
}

function ChipRow({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: string; active: boolean; onPress: () => void }[];
}) {
  return (
    <View style={styles.chipBlock}>
      <Txt variant="label" color={palette.textMuted}>
        {label}
      </Txt>
      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => {
              Haptics.selectionAsync();
              option.onPress();
            }}
            style={({ pressed }) => [
              styles.chip,
              option.active && styles.chipActive,
              pressed && styles.pressed,
            ]}>
            <Txt variant="label" color={option.active ? palette.bg : palette.textMuted}>
              {option.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.sm },
  section: { gap: spacing.md },
  rows: { padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 1 },
  note: { lineHeight: 17, marginTop: -spacing.xs },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  switchText: { flex: 1, gap: 1 },

  chipBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: { backgroundColor: palette.text, borderColor: palette.text },

  footer: { textAlign: 'center', paddingTop: spacing.lg },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sheetList: { maxHeight: 400 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  currencyText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
