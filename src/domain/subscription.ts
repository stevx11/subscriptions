/**
 * The core domain type and the questions the UI asks about it.
 *
 * Everything here is a pure function of a subscription plus a reference date.
 * Nothing reads the clock on its own — the caller passes `today`, which is what
 * makes "what renews next" testable and what stops two parts of a screen
 * disagreeing because they sampled the clock a millisecond apart.
 */

import {
  BillingCycle,
  nextOccurrenceAfter,
  occurrencesBetween,
  occurrencesPerYear,
} from './cycle';
import { CurrencyCode } from './currency';
import { daysBetween, IsoDate, todayIso } from './date';
import { Money } from './money';

export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled';

export interface PricePoint {
  /** When this price took effect. */
  since: IsoDate;
  amount: number;
  currency: CurrencyCode;
}

export interface Subscription {
  id: string;
  name: string;
  /** Key into the brand catalogue; absent for anything hand-entered. */
  brandId?: string;
  /** Hex colour, from the brand catalogue or picked by the user. */
  color: string;
  category: string;

  price: Money;
  cycle: BillingCycle;
  /**
   * The date billing is anchored to — normally the first charge. Every future
   * billing date is derived from this, so it must not be overwritten as time
   * passes (see the clamping note in `cycle.ts`).
   */
  anchorDate: IsoDate;

  status: SubscriptionStatus;
  /** When a trial converts to paid. Only meaningful while status is 'trial'. */
  trialEndsAt?: IsoDate;
  /** Set when status becomes 'cancelled', for "you saved X" reporting. */
  cancelledAt?: IsoDate;

  /** Days before a charge to remind. `null` means "use the global default". */
  reminderDaysBefore: number | null;
  /** 0-3, how much the user reckons they actually use it. Drives waste hints. */
  usageRating?: number;

  notes?: string;
  cancelUrl?: string;
  priceHistory: PricePoint[];

  createdAt: string;
  updatedAt: string;
}

/** A subscription only costs money while it is active or in a paid trial. */
export function isBilling(subscription: Subscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trial';
}

/**
 * When this subscription next takes money, or null if it never will again.
 *
 * A trial bills on the day it converts, not on its billing anchor — that is the
 * date the user actually needs warning about.
 */
export function nextBillingDate(
  subscription: Subscription,
  today: IsoDate = todayIso(),
): IsoDate | null {
  if (!isBilling(subscription)) {
    return null;
  }
  if (subscription.status === 'trial' && subscription.trialEndsAt) {
    return daysBetween(today, subscription.trialEndsAt) >= 0
      ? subscription.trialEndsAt
      : nextOccurrenceAfter(subscription.anchorDate, subscription.cycle, today);
  }
  return nextOccurrenceAfter(subscription.anchorDate, subscription.cycle, today);
}

/** Whole days until the next charge; null when nothing is scheduled. */
export function daysUntilNextBilling(
  subscription: Subscription,
  today: IsoDate = todayIso(),
): number | null {
  const next = nextBillingDate(subscription, today);
  return next === null ? null : daysBetween(today, next);
}

/**
 * Cost per year in the subscription's own currency, as a possibly-fractional
 * number of minor units.
 *
 * Deliberately *not* rounded. Rounding each subscription before summing biases
 * the total — twenty subscriptions each rounded up by half a cent is a visible
 * error in the headline figure. Callers round once, after aggregating.
 */
export function yearlyCostMinor(subscription: Subscription): number {
  if (!isBilling(subscription)) {
    return 0;
  }
  return subscription.price.amount * occurrencesPerYear(subscription.cycle);
}

/** Cost per month in the subscription's own currency, unrounded minor units. */
export function monthlyCostMinor(subscription: Subscription): number {
  return yearlyCostMinor(subscription) / 12;
}

/**
 * The most recent price rise, if there is one.
 * Returns the difference and how long ago it happened.
 */
export function lastPriceChange(
  subscription: Subscription,
): { from: Money; to: Money; since: IsoDate } | null {
  const history = subscription.priceHistory;
  if (history.length < 2) {
    return null;
  }
  const sorted = [...history].sort((a, b) => (a.since < b.since ? -1 : 1));
  const previous = sorted[sorted.length - 2];
  const latest = sorted[sorted.length - 1];
  if (previous.amount === latest.amount && previous.currency === latest.currency) {
    return null;
  }
  return {
    from: { amount: previous.amount, currency: previous.currency },
    to: { amount: latest.amount, currency: latest.currency },
    since: latest.since,
  };
}

/**
 * How much this subscription has taken since it started billing.
 *
 * Counts real charges from the anchor up to and including today, so a yearly
 * plan bought three years ago reads as three payments, not thirty-six. Returns
 * unrounded minor units in the subscription's own currency.
 */
export function totalPaidMinor(
  subscription: Subscription,
  today: IsoDate = todayIso(),
): { amountMinor: number; charges: number } {
  const start =
    subscription.status === 'trial' && subscription.trialEndsAt
      ? subscription.trialEndsAt
      : subscription.anchorDate;

  if (daysBetween(start, today) < 0) {
    return { amountMinor: 0, charges: 0 };
  }

  // A cancelled subscription stopped taking money when it was cancelled.
  const end =
    subscription.status === 'cancelled' && subscription.cancelledAt
      ? subscription.cancelledAt
      : today;

  const charges = occurrencesBetween(start, subscription.cycle, start, end).length;
  return { amountMinor: subscription.price.amount * charges, charges };
}
