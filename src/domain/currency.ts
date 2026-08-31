/**
 * The currencies offered in the add-subscription dropdown.
 *
 * Deliberately a curated list rather than all ~180 ISO codes: a picker you
 * scroll past 180 entries in is worse than one covering everything you'll
 * realistically be billed in. `decimals` matters — it is the exponent used to
 * convert between minor units and the displayed amount, and it is not always 2
 * (JPY and HUF are billed in whole units).
 */

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** Number of minor-unit digits. 2 for EUR (cents), 0 for JPY. */
  decimals: number;
}

export const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimals: 2 },
  { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar', decimals: 2 },
  { code: 'BAM', symbol: 'KM', name: 'Bosnian Mark', decimals: 2 },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', decimals: 2 },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', decimals: 2 },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', decimals: 0 },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', decimals: 2 },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', decimals: 2 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimals: 2 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimals: 2 },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimals: 2 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', decimals: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimals: 2 },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

const BY_CODE: ReadonlyMap<string, CurrencyInfo> = new Map(
  CURRENCIES.map((c) => [c.code, c]),
);

export function getCurrency(code: CurrencyCode): CurrencyInfo {
  const found = BY_CODE.get(code);
  if (!found) {
    throw new Error(`Unknown currency: ${code}`);
  }
  return found;
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return BY_CODE.has(value);
}

/** 10 ** decimals — how many minor units make one major unit. */
export function minorUnitScale(code: CurrencyCode): number {
  return 10 ** getCurrency(code).decimals;
}
