/**
 * Currency conversion.
 *
 * Pure: this module never fetches anything. It takes a rate table someone else
 * loaded (from network or cache) and does the arithmetic. That keeps it
 * testable and keeps the app working offline — a stale rate is far better than
 * a blank total, so conversion never depends on connectivity.
 */

import { CurrencyCode, minorUnitScale } from './currency';
import { Money, roundHalfAwayFromZero } from './money';

export interface RateTable {
  /** The currency all rates are expressed against. */
  base: CurrencyCode;
  /** `rates[X]` = how many X one unit of `base` buys. */
  rates: Readonly<Record<string, number>>;
  /** When these rates were retrieved, ISO 8601 instant. */
  fetchedAt: string;
}

export class MissingRateError extends Error {
  constructor(public readonly currency: string) {
    super(`No exchange rate available for ${currency}`);
    this.name = 'MissingRateError';
  }
}

function rateFor(table: RateTable, currency: CurrencyCode): number {
  if (currency === table.base) {
    return 1;
  }
  const rate = table.rates[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new MissingRateError(currency);
  }
  return rate;
}

/**
 * Convert between currencies, rounding once at the end.
 *
 * Crosses via the table's base currency, which is exact enough for our purpose
 * and avoids needing a full N×N rate matrix. Differing minor-unit scales are
 * handled explicitly — converting €10.00 to JPY must produce whole yen, not
 * yen-with-cents.
 */
export function convertMoney(value: Money, to: CurrencyCode, table: RateTable): Money {
  if (value.currency === to) {
    return value;
  }
  const fromRate = rateFor(table, value.currency);
  const toRate = rateFor(table, to);

  const inBase = value.amount / minorUnitScale(value.currency) / fromRate;
  const converted = inBase * toRate * minorUnitScale(to);

  return { amount: roundHalfAwayFromZero(converted), currency: to };
}

/**
 * Convert only if possible; returns null when the rate is missing so callers
 * can show "—" instead of crashing a whole dashboard over one currency.
 */
export function tryConvertMoney(
  value: Money,
  to: CurrencyCode,
  table: RateTable | null,
): Money | null {
  if (!table) {
    return value.currency === to ? value : null;
  }
  try {
    return convertMoney(value, to, table);
  } catch (error) {
    if (error instanceof MissingRateError) {
      return null;
    }
    throw error;
  }
}

export function rateAgeHours(table: RateTable, now: Date = new Date()): number {
  const fetched = Date.parse(table.fetchedAt);
  if (Number.isNaN(fetched)) {
    return Number.POSITIVE_INFINITY;
  }
  return (now.getTime() - fetched) / 3_600_000;
}

/** Rates older than a day are worth refreshing, but remain usable. */
export function isRateTableStale(
  table: RateTable,
  maxAgeHours = 24,
  now: Date = new Date(),
): boolean {
  return rateAgeHours(table, now) >= maxAgeHours;
}
