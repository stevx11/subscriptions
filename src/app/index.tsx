import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

/**
 * Phase 0 smoke test.
 *
 * This screen exists to prove four things on the real device before any of the
 * app gets built on top of them:
 *   1. Expo Go can load the project at all
 *   2. Hot reload works (change HOT_RELOAD_PROBE below and watch it update)
 *   3. iOS grants notification permission and actually fires a scheduled local
 *      notification — the single riskiest assumption in the whole plan
 *   4. Haptics work
 *
 * It gets deleted in Phase 1. Nothing here is production code.
 */

// ── Change this string (or the colour) and save — the phone should update in
// about a second, without you touching anything.
const HOT_RELOAD_PROBE = 'edit me and save';
const PROBE_COLOR = '#3D596D';

type LogEntry = { at: string; text: string; kind: 'ok' | 'warn' | 'info' };

export default function Phase0Screen() {
  const [permission, setPermission] = useState<string>('checking…');
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const addLog = useCallback((text: string, kind: LogEntry['kind'] = 'info') => {
    const at = new Date().toLocaleTimeString();
    setLog((prev) => [{ at, text, kind }, ...prev].slice(0, 12));
  }, []);

  const refreshScheduled = useCallback(async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledCount(all.length);
    return all.length;
  }, []);

  useEffect(() => {
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      setPermission(settings.granted ? 'granted' : settings.status);
      await refreshScheduled();
    })();

    // Fires when a notification arrives while the app is open.
    const sub = Notifications.addNotificationReceivedListener((n) => {
      addLog(`RECEIVED: ${n.request.content.title}`, 'ok');
      refreshScheduled();
    });
    return () => sub.remove();
  }, [addLog, refreshScheduled]);

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const requestPermission = async () => {
    tap();
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    setPermission(result.granted ? 'granted' : result.status);
    addLog(
      result.granted ? 'Permission granted' : `Permission: ${result.status}`,
      result.granted ? 'ok' : 'warn',
    );
  };

  const schedule = async (seconds: number) => {
    tap();
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      addLog('Permission not granted yet — tap "Allow notifications"', 'warn');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Netflix renews tomorrow',
        body: '€13.99 will be charged on your card.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    const count = await refreshScheduled();
    addLog(`Scheduled for +${seconds}s (${count} pending)`, 'ok');
  };

  const cancelAll = async () => {
    tap();
    await Notifications.cancelAllScheduledNotificationsAsync();
    await refreshScheduled();
    addLog('Cancelled all scheduled notifications', 'info');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>PHASE 0 · SMOKE TEST</Text>
        <Text style={styles.title}>Subscriptions</Text>

        <View style={[styles.probe, { backgroundColor: PROBE_COLOR }]}>
          <Text style={styles.probeLabel}>hot reload probe</Text>
          <Text style={styles.probeValue}>{HOT_RELOAD_PROBE}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Platform" value={`${Platform.OS} ${Platform.Version}`} />
          <Row label="Running in" value={isExpoGo ? 'Expo Go' : 'standalone build'} />
          <Row
            label="Notifications"
            value={permission}
            tone={permission === 'granted' ? 'ok' : 'warn'}
          />
          <Row
            label="Pending"
            value={scheduledCount === null ? '—' : String(scheduledCount)}
          />
        </View>

        <Button label="Allow notifications" onPress={requestPermission} primary />
        <Button label="Fire a reminder in 10 seconds" onPress={() => schedule(10)} />
        <Button label="Fire a reminder in 60 seconds" onPress={() => schedule(60)} />
        <Button label="Cancel all pending" onPress={cancelAll} subdued />

        <Text style={styles.hint}>
          For the real test: tap the 60-second button, then lock your phone or
          switch to another app. The notification should still arrive.
        </Text>

        <Text style={styles.logTitle}>Log</Text>
        {log.length === 0 ? (
          <Text style={styles.logEmpty}>Nothing yet.</Text>
        ) : (
          log.map((entry, i) => (
            <View key={`${entry.at}-${i}`} style={styles.logRow}>
              <Text style={styles.logTime}>{entry.at}</Text>
              <Text style={[styles.logText, styles[entry.kind]]}>{entry.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone === 'ok' && styles.ok, tone === 'warn' && styles.warn]}>
        {value}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  primary,
  subdued,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  subdued?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        subdued && styles.buttonSubdued,
        pressed && styles.buttonPressed,
      ]}>
      <Text style={[styles.buttonText, subdued && styles.buttonTextSubdued]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1319' },
  scroll: { padding: 20, paddingBottom: 48, gap: 12 },
  eyebrow: { color: '#6B7C8C', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: '#F2F5F7', fontSize: 34, fontWeight: '800', marginBottom: 8 },

  probe: { borderRadius: 18, padding: 18, marginBottom: 4 },
  probeLabel: { color: '#C8D6E0', fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  probeValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 4 },

  card: {
    backgroundColor: '#161C24',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLabel: { color: '#8496A6', fontSize: 14 },
  rowValue: { color: '#E8EEF3', fontSize: 14, fontWeight: '600' },
  ok: { color: '#5BD99A' },
  warn: { color: '#F0B450' },
  info: { color: '#A9BAC8' },

  button: {
    backgroundColor: '#1B242E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3542',
  },
  buttonPrimary: { backgroundColor: '#3D596D', borderColor: '#4E6E85' },
  buttonSubdued: { backgroundColor: 'transparent', borderColor: '#2A3542' },
  buttonPressed: { opacity: 0.65 },
  buttonText: { color: '#F2F5F7', fontSize: 15, fontWeight: '600' },
  buttonTextSubdued: { color: '#8496A6' },

  hint: {
    color: '#6B7C8C',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 8,
  },

  logTitle: {
    color: '#6B7C8C',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: 8,
  },
  logEmpty: { color: '#4A5765', fontSize: 13, fontStyle: 'italic' },
  logRow: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  logTime: { color: '#4A5765', fontSize: 12, fontVariant: ['tabular-nums'] },
  logText: { color: '#A9BAC8', fontSize: 12, flex: 1 },
});
