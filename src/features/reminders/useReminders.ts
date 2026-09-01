import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '@/data/store';
import { todayIso } from '@/domain/date';
import { planReminders, planSignature, ReminderPlan } from './plan';
import { applyPlan, hasPermission, requestPermission } from './scheduler';

export interface RemindersState {
  /** Whether iOS has granted notification permission. */
  permitted: boolean;
  /** Whether the user has reminders switched on in settings. */
  enabled: boolean;
  /** The reminders currently planned (not necessarily all scheduled). */
  plans: ReminderPlan[];
  /** How many were actually handed to iOS on the last sync. */
  scheduled: number;
  /** Turns reminders on, asking for permission if needed. */
  enable: () => Promise<boolean>;
  disable: () => void;
}

/**
 * Keeps iOS's scheduled notifications matching the current data.
 *
 * Reschedules whenever the *plan* changes rather than whenever the store
 * changes — editing a note or pausing an unrelated subscription should not
 * rewrite the whole notification schedule.
 *
 * Also re-syncs when the app returns to the foreground. Without that, an app
 * left open across midnight keeps a plan built for yesterday, and reminders
 * drift a day out of date the longer it stays open.
 */
export function useReminders(): RemindersState {
  const subscriptions = useAppStore((state) => state.subscriptions);
  const settings = useAppStore((state) => state.settings);
  const hydrated = useAppStore((state) => state.hydrated);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [permitted, setPermitted] = useState(false);
  const [scheduled, setScheduled] = useState(0);
  const [today, setToday] = useState(todayIso);

  const lastSignature = useRef<string | null>(null);

  const reminderSettings = useMemo(
    () => ({
      remindersEnabled: settings.remindersEnabled,
      defaultReminderDays: settings.defaultReminderDays,
      reminderHour: settings.reminderHour,
    }),
    [settings.remindersEnabled, settings.defaultReminderDays, settings.reminderHour],
  );

  const plans = useMemo(
    () => planReminders(subscriptions, reminderSettings, today),
    [subscriptions, reminderSettings, today],
  );

  const signature = useMemo(
    () => planSignature(plans, reminderSettings.reminderHour),
    [plans, reminderSettings.reminderHour],
  );

  useEffect(() => {
    hasPermission().then(setPermitted);
  }, []);

  // Rebuild against the real date whenever the app comes back to the front.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayIso());
        hasPermission().then(setPermitted);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!permitted && reminderSettings.remindersEnabled) {
      // Nothing can be scheduled without permission; leave the schedule alone
      // rather than repeatedly clearing it.
      return;
    }
    if (lastSignature.current === signature) {
      return;
    }

    let cancelled = false;
    lastSignature.current = signature;

    applyPlan(plans, reminderSettings.reminderHour).then((result) => {
      if (!cancelled) {
        setScheduled(result.scheduled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    permitted,
    signature,
    plans,
    reminderSettings.reminderHour,
    reminderSettings.remindersEnabled,
  ]);

  const enable = useCallback(async () => {
    const granted = (await hasPermission()) || (await requestPermission());
    setPermitted(granted);
    if (granted) {
      updateSettings({ remindersEnabled: true });
      // Force the next effect run to reschedule even if the plan text matches.
      lastSignature.current = null;
    }
    return granted;
  }, [updateSettings]);

  const disable = useCallback(() => {
    updateSettings({ remindersEnabled: false });
    lastSignature.current = null;
  }, [updateSettings]);

  return {
    permitted,
    enabled: settings.remindersEnabled,
    plans,
    scheduled,
    enable,
    disable,
  };
}
