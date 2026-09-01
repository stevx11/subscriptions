/**
 * The numbers behind the Insights screen.
 *
 * Pure, so every figure the screen asserts can be checked without rendering
 * anything. This matters more here than elsewhere: an insight is a *claim*
 * ("this went up 12%", "you have paid €340 for this"), and a wrong claim is
 * worse than no claim.
 */

import { CurrencyCode } from '@/domain/currency';
import { addMonths, endOfMonth, IsoDate, startOfMonth, todayIso } from '@/domain/date';
import { convertMoney, MissingRateError, RateTable } from '@/domain/fx';
import { Money } from '@/domain/money';
import {
  isBilling,
  lastPriceChange,
  Subscription,
  yearlyCostMinor,
} from '@/domain/subscription';
import { chargesBetween, CategoryTotal, totalsByCategory, toMoney } from '@/domain/totals';

export interface MonthPoint {
  /** First day of the month. */
  month: IsoDate;
  total: Money;
  count: number;
  /** True for months that have not happened yet. */
  projected: boolean;
}

/**
 * Actual charges per calendar month, looking back and forward.
 *
 * Uses real charge dates rather than the amortised monthly average, so a yearly
 * plan shows as one tall bar in its billing month instead of a flat smear —
 * which is the entire point of looking at a trend.
 *
 * Past months are historical only in the sense that the *schedule* says a
 * charge fell then; the app has no record of actual payments, so these are
 * computed, not observed. The screen must not label them "spent".
 */
export function monthlySpend(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
  today: IsoDate = todayIso(),
  monthsBack = 5,
  monthsForward = 6,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  const currentMonth = startOfMonth(today);

  for (let offset = -monthsBack; offset <= monthsForward; offset += 1) {
    const month = startOfMonth(addMonths(currentMonth, offset));
    const window = chargesBetween(
      subscriptions,
      homeCurrency,
      rates,
      month,
      endOfMonth(month),
    );
    points.push({
      month,
      total: window.total,
      count: window.count,
      projected: offset > 0,
    });
  }

  return points;
}

export interface ExpensiveEntry {
  subscription: Subscription;
  /** Yearly cost converted to the home currency. */
  yearly: Money;
  /** Share of total yearly spend, 0-1. */
  share: number;
}

/** The subscriptions costing most per year, converted and ranked. */
export function mostExpensive(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
  limit = 5,
): ExpensiveEntry[] {
  const entries: { subscription: Subscription; minor: number }[] = [];

  for (const subscription of subscriptions) {
    if (!isBilling(subscription)) continue;
    const own = yearlyCostMinor(subscription);
    try {
      const converted =
        subscription.price.currency === homeCurrency
          ? own
          : convertScaled(own, subscription.price.currency, homeCurrency, rates);
      entries.push({ subscription, minor: converted });
    } catch (error) {
      if (error instanceof MissingRateError) continue;
      throw error;
    }
  }

  const grandTotal = entries.reduce((sum, entry) => sum + entry.minor, 0);

  return entries
    .sort((a, b) => b.minor - a.minor)
    .slice(0, limit)
    .map((entry) => ({
      subscription: entry.subscription,
      yearly: toMoney(entry.minor, homeCurrency),
      share: grandTotal === 0 ? 0 : entry.minor / grandTotal,
    }));
}

/** Convert a fractional minor amount without losing sub-unit precision. */
function convertScaled(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateTable | null,
): number {
  if (!rates) {
    throw new MissingRateError(from);
  }
  const SCALE = 1_000_000;
  const scaled = convertMoney(
    { amount: Math.round(amountMinor * SCALE), currency: from },
    to,
    rates,
  );
  return scaled.amount / SCALE;
}

export interface PriceRise {
  subscription: Subscription;
  from: Money;
  to: Money;
  since: IsoDate;
  /** Fractional increase: 0.12 means it went up 12%. */
  fraction: number;
}

/**
 * Subscriptions whose price went *up*, most recently first.
 *
 * Only rises — a price drop is not something anyone needs alerting to, and
 * mixing them dilutes the signal.
 */
export function priceRises(subscriptions: readonly Subscription[]): PriceRise[] {
  const rises: PriceRise[] = [];

  for (const subscription of subscriptions) {
    const change = lastPriceChange(subscription);
    if (!change) continue;
    // Comparing across a currency change is meaningless as a percentage.
    if (change.from.currency !== change.to.currency) continue;
    if (change.to.amount <= change.from.amount) continue;
    if (change.from.amount === 0) continue;

    rises.push({
      subscription,
      from: change.from,
      to: change.to,
      since: change.since,
      fraction: (change.to.amount - change.from.amount) / change.from.amount,
    });
  }

  return rises.sort((a, b) => (a.since < b.since ? 1 : -1));
}

/**
 * Things the user has marked as barely used, most expensive first — the
 * shortlist for cancelling something.
 */
export function rarelyUsed(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
): ExpensiveEntry[] {
  const candidates = subscriptions.filter(
    (s) => isBilling(s) && s.usageRating !== undefined && s.usageRating <= 1,
  );
  return mostExpensive(candidates, homeCurrency, rates, candidates.length);
}

/**
 * Category totals, capped so the chart stays readable.
 *
 * Everything past the cap folds into a single "Other" bar rather than being
 * dropped or given its own generated colour.
 */
export function categoryBreakdown(
  subscriptions: readonly Subscription[],
  homeCurrency: CurrencyCode,
  rates: RateTable | null,
  cap = 6,
): CategoryTotal[] {
  const all = totalsByCategory(subscriptions, homeCurrency, rates);
  if (all.length <= cap) {
    return all;
  }

  const kept = all.slice(0, cap - 1);
  const rest = all.slice(cap - 1);

  const otherMinor = rest.reduce((sum, entry) => sum + entry.monthly.amount, 0);
  const otherShare = rest.reduce((sum, entry) => sum + entry.share, 0);
  const otherCount = rest.reduce((sum, entry) => sum + entry.count, 0);

  return [
    ...kept,
    {
      category: 'Other',
      monthly: { amount: otherMinor, currency: homeCurrency },
      share: otherShare,
      count: otherCount,
    },
  ];
}
