/**
 * Money as integer minor units.
 *
 * €13.99 is stored as `{ amount: 1399, currency: 'EUR' }`, never as `13.99`.
 * Binary floating point cannot represent most decimal fractions exactly, so
 * float money accumulates error silently: `0.1 + 0.2 !== 0.3`, and a year of
 * summed subscription costs drifts by cents that are impossible to explain to
 * the person reading the total. Integers make the arithmetic exact.
 *
 * Rounding happens only at explicit boundaries — parsing user input, and
 * converting between currencies or billing cycles. Everything in between is
 * exact.
 */

import { CurrencyCode, getCurrency, minorUnitScale } from './currency';

export interface Money {
  /** Integer, in the currency's minor units (cents, pence, …). */
  amount: number;
  currency: CurrencyCode;
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money amount must be an integer in minor units, got ${amount}`);
  }
  return { amount, currency };
}

export function zeroMoney(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

/**
 * Round half away from zero, the convention people expect for money
 * (0.5 → 1, -0.5 → -1). `Math.round` rounds half *up*, which sends -0.5 to 0.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Parse typed input into Money.
 *
 * Accepts both `13.99` and `13,99` — a European keyboard produces the comma,
 * and rejecting it would be a pointless irritation. Thousands separators are
 * stripped. Parsing is done on the *string* rather than via `parseFloat` so
 * that `19.99` becomes exactly 1999 rather than 1998.9999999999998.
 */
export function parseMoney(input: string, currency: CurrencyCode): Money {
  const decimals = getCurrency(currency).decimals;
  const cleaned = input.trim().replace(/\s/g, '');
  if (cleaned === '') {
    throw new Error('Empty amount');
  }

  const negative = cleaned.startsWith('-');
  let body = negative ? cleaned.slice(1) : cleaned;

  // Whichever separator appears last is the decimal one; anything else is a
  // thousands separator. "1.234,56" and "1,234.56" both mean the same thing.
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');
  const decimalPos = Math.max(lastComma, lastDot);

  let whole: string;
  let fraction: string;
  if (decimalPos === -1) {
    whole = body;
    fraction = '';
  } else {
    whole = body.slice(0, decimalPos);
    fraction = body.slice(decimalPos + 1);
  }
  whole = whole.replace(/[.,]/g, '');

  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Not a valid amount: ${JSON.stringify(input)}`);
  }
  if (whole === '' && fraction === '') {
    throw new Error(`Not a valid amount: ${JSON.stringify(input)}`);
  }

  // Pad or round the fraction to the currency's precision.
  let minor: number;
  if (fraction.length <= decimals) {
    minor = Number(fraction.padEnd(decimals, '0') || '0');
  } else {
    const kept = Number(fraction.slice(0, decimals) || '0');
    const nextDigit = Number(fraction[decimals]);
    minor = nextDigit >= 5 ? kept + 1 : kept;
  }

  const scale = minorUnitScale(currency);
  const total = Number(whole || '0') * scale + minor;
  return { amount: negative ? -total : total, currency };
}

/** Minor units → a plain number. For display and charts only, never storage. */
export function toDecimal(value: Money): number {
  return value.amount / minorUnitScale(value.currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot combine ${a.currency} and ${b.currency} directly — convert via fx first`,
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function multiplyMoney(value: Money, factor: number): Money {
  return {
    amount: roundHalfAwayFromZero(value.amount * factor),
    currency: value.currency,
  };
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount - b.amount;
}

export function isZeroMoney(value: Money): boolean {
  return value.amount === 0;
}

/** Sum same-currency amounts. Throws on a mixed-currency list by design. */
export function sumMoney(values: readonly Money[], currency: CurrencyCode): Money {
  let total = 0;
  for (const value of values) {
    if (value.currency !== currency) {
      throw new Error(`Expected ${currency} but found ${value.currency} in sum`);
    }
    total += value.amount;
  }
  return { amount: total, currency };
}

export interface FormatMoneyOptions {
  /** Drop the fractional part when it is zero: "€14" rather than "€14.00". */
  compactWholeAmounts?: boolean;
  /** Omit the currency symbol entirely. */
  omitSymbol?: boolean;
  locale?: string;
}

/**
 * Format for display.
 *
 * Uses `Intl.NumberFormat` for correct grouping and decimal separators, but
 * substitutes our own symbol so the output stays consistent with the currency
 * picker the user chose from.
 */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const info = getCurrency(value.currency);
  const { compactWholeAmounts = false, omitSymbol = false, locale = 'en-GB' } = options;

  const isWhole = value.amount % minorUnitScale(value.currency) === 0;
  const digits = compactWholeAmounts && isWhole ? 0 : info.decimals;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toDecimal(value));

  if (omitSymbol) {
    return formatted;
  }
  // Symbols that are words (CHF, KM, zł) read better trailing; glyphs lead.
  const trailing = info.symbol.length > 1 && !/^[^\p{L}]+$/u.test(info.symbol);
  return trailing ? `${formatted} ${info.symbol}` : `${info.symbol}${formatted}`;
}
