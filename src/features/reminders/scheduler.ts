/**
 * Turning a reminder plan into actual iOS notifications.
 *
 * The impure half of the feature; all the decisions live in `plan.ts`.
 *
 * Strategy is deliberately "cancel everything, reschedule everything" rather
 * than diffing. The app owns every notification it schedules, the plan is
 * capped at ~56 entries, and the whole operation runs only when the plan's
 * signature actually changes. A diff would be more code and more ways to end
 * up with a stale duplicate announcing last month's price.
 */

import * as Notifications from 'expo-notifications';

import { fireInstant, ReminderPlan } from './plan';

export interface SyncResult {
  scheduled: number;
  /** Plans whose moment had already passed today. */
  skipped: number;
}

export async function hasPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

/**
 * Ask for notification permission.
 *
 * iOS only ever shows this prompt once, so it should be triggered by a
 * deliberate action rather than fired on launch — a denied prompt the user
 * never meant to answer cannot be re-asked from inside the app.
 */
export async function requestPermission(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return result.granted;
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function countScheduled(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** Replace every scheduled notification with the given plan. */
export async function applyPlan(
  plans: readonly ReminderPlan[],
  hour: number,
  now: Date = new Date(),
): Promise<SyncResult> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  let skipped = 0;

  for (const plan of plans) {
    const when = fireInstant(plan, hour, now);
    if (when === null) {
      skipped += 1;
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: plan.key,
      content: {
        title: plan.title,
        body: plan.body,
        sound: true,
        // Lets a tapped notification deep-link to the subscription later.
        data: { subscriptionId: plan.subscriptionId, chargeOn: plan.chargeOn },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    scheduled += 1;
  }

  return { scheduled, skipped };
}
