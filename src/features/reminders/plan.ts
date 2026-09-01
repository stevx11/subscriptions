/**
 * Deciding *what* to be reminded about, separately from actually scheduling it.
 *
 * This is the app's headline promise — never be surprised by a charge — so the
 * rules live in a pure function that can be tested rather than inside an effect
 * that can only be observed by waiting a day and seeing what happens.
 *
 * The awkward constraint driving the design: **iOS allows at most 64 pending
 * local notifications per app.** Past that, new ones silently fail to schedule.
 * With twenty subscriptions and a year's horizon that limit is trivially
 * exceeded, so the plan is always sorted by date and truncated — the nearest
 * reminders are the ones that matter, and the far ones get rescheduled long
 * before they come due.
 */

import { describeCycle, occurrencesBetween } from '@/domain/cycle';
import { addDays, compareIsoDate, daysBetween, IsoDate, todayIso } from '@/domain/date';
import { formatMoney } from '@/domain/money';
import { isBilling, Subscription } from '@/domain/subscription';

/** iOS caps pending local notifications at 64; leave headroom. */
export const MAX_SCHEDULED = 56;

/** How far ahead to plan. Anything further is re-planned on a later launch. */
export const HORIZON_DAYS = 120;

export type ReminderKind = 'charge' | 'trial';

export interface ReminderPlan {
  /** Stable across re-plans, so the same reminder is not duplicated. */
  key: string;
  subscriptionId: string;
  kind: ReminderKind;
  /** The day the notification fires. */
  fireOn: IsoDate;
  /** The day money actually moves. */
  chargeOn: IsoDate;
  title: string;
  body: string;
}

export interface ReminderSettings {
  remindersEnabled: boolean;
  /** Used when a subscription has no override. */
  defaultReminderDays: number;
  /** Local hour of day to fire, 0-23. */
  reminderHour: number;
}

function leadTime(subscription: Subscription, settings: ReminderSettings): number {
  const days = subscription.reminderDaysBefore ?? settings.defaultReminderDays;
  return Math.max(0, Math.round(days));
}

function phrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * The reminders that should exist right now.
 *
 * Deterministic given the same inputs, which is what lets the scheduler decide
 * whether anything actually needs rewriting.
 */
export function planReminders(
  subscriptions: readonly Subscription[],
  settings: ReminderSettings,
  today: IsoDate = todayIso(),
): ReminderPlan[] {
  if (!settings.remindersEnabled) {
    return [];
  }

  const plans: ReminderPlan[] = [];
  const horizonEnd = addDays(today, HORIZON_DAYS);

  for (const subscription of subscriptions) {
    if (!isBilling(subscription)) {
      continue;
    }

    const lead = leadTime(subscription, settings);
    const isTrial = subscription.status === 'trial';

    // A trial's charges start the day it converts, which may sit apart from
    // the billing anchor on older records.
    const anchor = isTrial && subscription.trialEndsAt ? subscription.trialEndsAt : subscription.anchorDate;

    // Look back by the lead time so a charge just inside the horizon whose
    // reminder falls today is not missed.
    const charges = occurrencesBetween(
      anchor,
      subscription.cycle,
      today,
      addDays(horizonEnd, lead),
    );

    for (const chargeOn of charges) {
      const fireOn = addDays(chargeOn, -lead);

      // Never schedule into the past. A reminder for a charge that already
      // happened is noise, and iOS would drop it anyway.
      if (compareIsoDate(fireOn, today) < 0) {
        continue;
      }
      if (compareIsoDate(fireOn, horizonEnd) > 0) {
        continue;
      }

      const daysAhead = daysBetween(fireOn, chargeOn);
      const amount = formatMoney(subscription.price);

      // The first charge of a converting trial is the one people are actually
      // surprised by, so it gets its own wording.
      const trialConversion = isTrial && chargeOn === subscription.trialEndsAt;

      plans.push({
        key: `${subscription.id}:${chargeOn}`,
        subscriptionId: subscription.id,
        kind: trialConversion ? 'trial' : 'charge',
        fireOn,
        chargeOn,
        title: trialConversion
          ? `${subscription.name} trial ends ${phrase(daysAhead)}`
          : `${subscription.name} renews ${phrase(daysAhead)}`,
        body: trialConversion
          ? `It starts charging ${amount} ${describeCycle(subscription.cycle).toLowerCase()} unless you cancel.`
          : `${amount} will be charged.`,
      });
    }
  }

  return plans
    .sort((a, b) => compareIsoDate(a.fireOn, b.fireOn) || a.key.localeCompare(b.key))
    .slice(0, MAX_SCHEDULED);
}

/**
 * A fingerprint of a plan, used to skip rewriting the schedule when nothing
 * meaningful changed. Rescheduling on every keystroke in the edit form would
 * be pointless work against the notification system.
 */
export function planSignature(plans: readonly ReminderPlan[], hour: number): string {
  // The body must be part of this. It carries the amount, so a price change
  // alters the body while leaving the title identical — without it, a
  // subscription that went up in price would keep announcing the old figure.
  return `${hour}|${plans
    .map((plan) => `${plan.key}@${plan.fireOn}:${plan.title}:${plan.body}`)
    .join(',')}`;
}

/**
 * The exact instant a plan should fire, in local time.
 *
 * Returns null when that instant has already passed — which happens routinely
 * for a same-day reminder on an app opened in the evening. Scheduling it would
 * either fire immediately or be dropped; skipping is the honest option.
 */
export function fireInstant(
  plan: ReminderPlan,
  hour: number,
  now: Date = new Date(),
): Date | null {
  const [year, month, day] = plan.fireOn.split('-').map(Number);
  const when = new Date(year, month - 1, day, hour, 0, 0, 0);
  return when.getTime() <= now.getTime() ? null : when;
}
