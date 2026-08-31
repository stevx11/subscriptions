/**
 * Billing cycles and when the next charge lands.
 *
 * The subtle bug this file exists to avoid: a subscription anchored on the 31st
 * must bill on Jan 31, Feb 28, Mar 31 — not Jan 31, Feb 28, Mar 28. Stepping
 * month by month from the previous (already clamped) date loses the anchor
 * permanently, and the error compounds. So every occurrence is computed as
 * `anchor + n × interval` from the *original* anchor, and clamping is applied
 * once, at the end.
 */

import { addDays, addMonths, addWeeks, compareIsoDate, IsoDate } from './date';

export type CycleUnit = 'day' | 'week' | 'month' | 'year';

export interface BillingCycle {
  unit: CycleUnit;
  /** Every N units. `{ unit: 'month', interval: 3 }` is quarterly. */
  interval: number;
}

export const CYCLE_PRESETS = {
  weekly: { unit: 'week', interval: 1 },
  fortnightly: { unit: 'week', interval: 2 },
  monthly: { unit: 'month', interval: 1 },
  quarterly: { unit: 'month', interval: 3 },
  semiannual: { unit: 'month', interval: 6 },
  yearly: { unit: 'year', interval: 1 },
} as const satisfies Record<string, BillingCycle>;

export type CyclePresetName = keyof typeof CYCLE_PRESETS;

export function describeCycle(cycle: BillingCycle): string {
  const { unit, interval } = cycle;
  if (interval === 1) {
    return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[unit];
  }
  if (unit === 'month' && interval === 3) return 'Quarterly';
  if (unit === 'month' && interval === 6) return 'Every 6 months';
  if (unit === 'week' && interval === 2) return 'Fortnightly';
  return `Every ${interval} ${unit}s`;
}

function assertValidCycle(cycle: BillingCycle): void {
  if (!Number.isInteger(cycle.interval) || cycle.interval < 1) {
    throw new Error(`Cycle interval must be a positive integer, got ${cycle.interval}`);
  }
}

/**
 * The nth billing date counting from the anchor (n = 0 is the anchor itself).
 * Always derived from the anchor, never from the previous occurrence.
 */
export function occurrenceAt(anchor: IsoDate, cycle: BillingCycle, n: number): IsoDate {
  assertValidCycle(cycle);
  const steps = cycle.interval * n;
  switch (cycle.unit) {
    case 'day':
      return addDays(anchor, steps);
    case 'week':
      return addWeeks(anchor, steps);
    case 'month':
      return addMonths(anchor, steps);
    case 'year':
      return addMonths(anchor, steps * 12);
  }
}

/**
 * Roughly how many days one cycle spans. Used only to jump close to the answer
 * before stepping exactly — never as the answer itself.
 */
function approximateDaysPerCycle(cycle: BillingCycle): number {
  const perUnit = { day: 1, week: 7, month: 30.436875, year: 365.2425 }[cycle.unit];
  return perUnit * cycle.interval;
}

/**
 * The first billing date strictly after `reference`.
 *
 * If the anchor is in the future, the anchor is the answer — a subscription
 * whose first charge hasn't happened yet bills on its start date.
 */
export function nextOccurrenceAfter(
  anchor: IsoDate,
  cycle: BillingCycle,
  reference: IsoDate,
): IsoDate {
  assertValidCycle(cycle);
  if (compareIsoDate(anchor, reference) > 0) {
    return anchor;
  }

  // Estimate n, then walk to the exact boundary. The estimate can be off by a
  // step or two around month-length variation and clamped anchors, so the
  // correction loops are what actually guarantee correctness.
  const daysAhead = compareIsoDate(reference, anchor);
  let n = Math.max(0, Math.floor(daysAhead / approximateDaysPerCycle(cycle)));

  while (compareIsoDate(occurrenceAt(anchor, cycle, n), reference) > 0 && n > 0) {
    n -= 1;
  }
  while (compareIsoDate(occurrenceAt(anchor, cycle, n), reference) <= 0) {
    n += 1;
  }
  return occurrenceAt(anchor, cycle, n);
}

/**
 * The most recent billing date on or before `reference`, or `null` if billing
 * hasn't started yet.
 */
export function lastOccurrenceOnOrBefore(
  anchor: IsoDate,
  cycle: BillingCycle,
  reference: IsoDate,
): IsoDate | null {
  if (compareIsoDate(anchor, reference) > 0) {
    return null;
  }
  // Largest n whose occurrence is still on or before the reference date.
  const daysAhead = compareIsoDate(reference, anchor);
  let n = Math.max(0, Math.floor(daysAhead / approximateDaysPerCycle(cycle)));
  while (n > 0 && compareIsoDate(occurrenceAt(anchor, cycle, n), reference) > 0) {
    n -= 1;
  }
  while (compareIsoDate(occurrenceAt(anchor, cycle, n + 1), reference) <= 0) {
    n += 1;
  }
  return occurrenceAt(anchor, cycle, n);
}

/** Every billing date in `[from, to]`, inclusive. */
export function occurrencesBetween(
  anchor: IsoDate,
  cycle: BillingCycle,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  assertValidCycle(cycle);
  if (compareIsoDate(from, to) > 0) {
    return [];
  }
  const results: IsoDate[] = [];
  let n = 0;
  const daysAhead = compareIsoDate(from, anchor);
  if (daysAhead > 0) {
    n = Math.max(0, Math.floor(daysAhead / approximateDaysPerCycle(cycle)) - 1);
  }
  // Guard against a pathological interval producing an unbounded loop.
  const limit = 10_000;
  for (let guard = 0; guard < limit; guard += 1, n += 1) {
    const date = occurrenceAt(anchor, cycle, n);
    if (compareIsoDate(date, to) > 0) break;
    if (compareIsoDate(date, from) >= 0) results.push(date);
  }
  return results;
}

/**
 * How many times this cycle bills in a year.
 *
 * Uses the mean Gregorian year (365.2425 days) so that weekly and daily cycles
 * normalise consistently with monthly ones over the long run. Fractional by
 * design — rounding here would bias every downstream total.
 */
export function occurrencesPerYear(cycle: BillingCycle): number {
  assertValidCycle(cycle);
  const perYear = { day: 365.2425, week: 365.2425 / 7, month: 12, year: 1 }[cycle.unit];
  return perYear / cycle.interval;
}
