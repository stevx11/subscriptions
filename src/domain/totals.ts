/**
 * Aggregation across subscriptions in mixed currencies.
 *
 * Two rules hold everything together:
 *   1. Round once, at the very end. Per-subscription rounding before summing
 *      introduces a bias that grows with the number of subscriptions.
 *   2. Never silently drop a subscription we cannot convert. If a rate is
 *      missing, the total says so, because a headline number that quietly
 *      omits one of your subscriptions is worse than no number at all.
 */

import { CurrencyCode, minorUnitScale } from './currency';
import { convertMoney, MissingRateError, RateTable } from './fx';
import { Money, roundHalfAwayFromZero } from './money';
import {
  isBilling,
  monthlyCostMinor,
  Subscription,
  yearlyCostMinor,
} from './subscription';

export interface SpendTotals {
  monthly: Money;
  yearly: Money;
  /** Subscriptions that could not be converted, by currency. */
  unconvertible: CurrencyCode[];
  /** How many subscriptions contributed to these figures. */
  counted: number;
}

/**
 * Convert an unrounded minor-unit amount in `from` into unrounded minor units
 * of `to`. Mirrors `convertMoney` but stays fractional so it can be summed.
 */
function convertMinorUnrounded(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  table: RateTable | null,
): number {
  if (from === to) {
    return amountMinor;
  }
  if (!table) {
    throw new MissingRateError(from);
  }
  // Route through convertMoney on a large scaled value to reuse its rate
  // handling, then undo the scaling. The factor keeps sub-minor-unit precision
  // that would otherwise be lost to convertMoney's rounding.
  const SCALE = 1_000_000;
  const scaled = convertMoney(
    { amount: roundHalfAwayFromZero(amountMinor * SCALE), currency: from },
    to,
    table,
  );
  return scaled.amount / SCALE;
}

export function computeTotals(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
): SpendTotals {
  let monthly = 0;
  let yearly = 0;
  let counted = 0;
  const unconvertible = new Set<CurrencyCode>();

  for (const subscription of subscriptions) {
    if (!isBilling(subscription)) {
      continue;
    }
    try {
      monthly += convertMinorUnrounded(
        monthlyCostMinor(subscription),
        subscription.price.currency,
        homeCurrency,
        rates,
      );
      yearly += convertMinorUnrounded(
        yearlyCostMinor(subscription),
        subscription.price.currency,
        homeCurrency,
        rates,
      );
      counted += 1;
    } catch (error) {
      if (error instanceof MissingRateError) {
        unconvertible.add(subscription.price.currency);
        continue;
      }
      throw error;
    }
  }

  return {
    monthly: { amount: roundHalfAwayFromZero(monthly), currency: homeCurrency },
    yearly: { amount: roundHalfAwayFromZero(yearly), currency: homeCurrency },
    unconvertible: [...unconvertible],
    counted,
  };
}

export interface CategoryTotal {
  category: string;
  monthly: Money;
  /** Share of the monthly total, 0-1. 0 when the total is zero. */
  share: number;
  count: number;
}

/** Monthly spend grouped by category, largest first. */
export function totalsByCategory(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
): CategoryTotal[] {
  const buckets = new Map<string, { minor: number; count: number }>();

  for (const subscription of subscriptions) {
    if (!isBilling(subscription)) continue;
    let converted: number;
    try {
      converted = convertMinorUnrounded(
        monthlyCostMinor(subscription),
        subscription.price.currency,
        homeCurrency,
        rates,
      );
    } catch (error) {
      if (error instanceof MissingRateError) continue;
      throw error;
    }
    const bucket = buckets.get(subscription.category) ?? { minor: 0, count: 0 };
    bucket.minor += converted;
    bucket.count += 1;
    buckets.set(subscription.category, bucket);
  }

  const grandTotal = [...buckets.values()].reduce((sum, b) => sum + b.minor, 0);

  return [...buckets.entries()]
    .map(([category, bucket]) => ({
      category,
      monthly: {
        amount: roundHalfAwayFromZero(bucket.minor),
        currency: homeCurrency,
      },
      share: grandTotal === 0 ? 0 : bucket.minor / grandTotal,
      count: bucket.count,
    }))
    .sort((a, b) => b.monthly.amount - a.monthly.amount);
}

/**
 * What switching a monthly subscription to its yearly plan would save, given a
 * yearly price. Positive means the yearly plan is cheaper.
 */
export function annualSavings(subscription: Subscription, yearlyPrice: Money): Money {
  if (yearlyPrice.currency !== subscription.price.currency) {
    throw new Error('Compare like-for-like currencies when computing savings');
  }
  const currentYearly = yearlyCostMinor(subscription);
  return {
    amount: roundHalfAwayFromZero(currentYearly - yearlyPrice.amount),
    currency: subscription.price.currency,
  };
}

/** Formatted-ready per-day cost, useful for "this costs you €0.46 a day". */
export function dailyCostMinor(subscription: Subscription): number {
  return yearlyCostMinor(subscription) / 365.2425;
}

/** Round a possibly-fractional minor amount into real Money. */
export function toMoney(amountMinor: number, currency: CurrencyCode): Money {
  void minorUnitScale(currency); // validates the code
  return { amount: roundHalfAwayFromZero(amountMinor), currency };
}
