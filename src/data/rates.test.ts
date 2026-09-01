import { parseRateResponse } from './rates';

const GOOD = {
  result: 'success',
  base_code: 'EUR',
  time_last_update_unix: 1_788_000_000,
  rates: { EUR: 1, USD: 1.159921, GBP: 0.856066, RSD: 117.321778, JPY: 185.579708 },
};

describe('parseRateResponse', () => {
  it('accepts a well-formed response', () => {
    const table = parseRateResponse(GOOD, 'EUR');
    expect(table).not.toBeNull();
    expect(table!.base).toBe('EUR');
    expect(table!.rates.USD).toBeCloseTo(1.159921, 6);
    expect(table!.rates.RSD).toBeCloseTo(117.321778, 6);
  });

  it('uses the upstream publish time, not the download time', () => {
    const table = parseRateResponse(GOOD, 'EUR');
    expect(table!.fetchedAt).toBe(new Date(1_788_000_000 * 1000).toISOString());
  });

  it('falls back to now when the timestamp is missing', () => {
    const { time_last_update_unix, ...withoutTime } = GOOD;
    void time_last_update_unix;
    const table = parseRateResponse(withoutTime, 'EUR');
    expect(table).not.toBeNull();
    expect(Number.isNaN(Date.parse(table!.fetchedAt))).toBe(false);
  });

  /**
   * A partially-applied rate table is worse than none: it produces totals that
   * look right and are wrong. Anything unexpected is rejected whole.
   */
  it.each([
    ['a failure result', { ...GOOD, result: 'error' }],
    ['a mismatched base', { ...GOOD, base_code: 'USD' }],
    ['missing rates', { ...GOOD, rates: undefined }],
    ['rates that are not an object', { ...GOOD, rates: 'nope' }],
    ['null', null],
    ['a string', 'nope'],
    ['an empty object', {}],
  ])('rejects %s', (_label, payload) => {
    expect(parseRateResponse(payload, 'EUR')).toBeNull();
  });

  it('rejects a response with no usable currencies', () => {
    expect(parseRateResponse({ ...GOOD, rates: { XYZ: 2, ABC: 3 } }, 'EUR')).toBeNull();
  });

  it('drops unusable individual rates but keeps the rest', () => {
    const table = parseRateResponse(
      {
        ...GOOD,
        rates: { USD: 1.16, GBP: 'nonsense', JPY: -4, CHF: Infinity, PLN: 0, SEK: 11.2 },
      },
      'EUR',
    );
    expect(table).not.toBeNull();
    expect(Object.keys(table!.rates).sort()).toEqual(['SEK', 'USD']);
  });

  it('ignores currencies the app cannot display', () => {
    const table = parseRateResponse({ ...GOOD, rates: { USD: 1.16, XAU: 0.0004 } }, 'EUR');
    expect(table!.rates.XAU).toBeUndefined();
    expect(table!.rates.USD).toBeCloseTo(1.16, 6);
  });
});
