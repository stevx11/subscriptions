import { BillingCycle, CYCLE_PRESETS } from './cycle';
import { CurrencyCode } from './currency';
import { RateTable } from './fx';
import { formatMoney, money } from './money';
import { Subscription } from './subscription';
import { annualSavings, computeTotals, totalsByCategory } from './totals';

const RATES: RateTable = {
  base: 'EUR',
  // Deliberately round numbers so expected values stay checkable by hand.
  rates: { USD: 1.1, GBP: 0.85, JPY: 160, RSD: 117 },
  fetchedAt: '2026-08-31T09:00:00.000Z',
};

function sub(
  overrides: Partial<Subscription> & { amount: number; currency: CurrencyCode },
): Subscription {
  const { amount, currency, ...rest } = overrides;
  return {
    id: rest.id ?? Math.random().toString(36).slice(2),
    name: rest.name ?? 'Test',
    color: '#000000',
    category: rest.category ?? 'Other',
    price: money(amount, currency),
    cycle: (rest.cycle as BillingCycle) ?? CYCLE_PRESETS.monthly,
    anchorDate: rest.anchorDate ?? '2026-01-15',
    status: rest.status ?? 'active',
    reminderDaysBefore: null,
    priceHistory: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...rest,
  };
}

describe('computeTotals', () => {
  it('is zero for no subscriptions', () => {
    const totals = computeTotals([], 'EUR', RATES);
    expect(totals.monthly.amount).toBe(0);
    expect(totals.yearly.amount).toBe(0);
    expect(totals.counted).toBe(0);
  });

  it('sums same-currency monthly subscriptions', () => {
    const totals = computeTotals(
      [sub({ amount: 1399, currency: 'EUR' }), sub({ amount: 999, currency: 'EUR' })],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(2398);
    expect(totals.yearly.amount).toBe(28776);
    expect(totals.counted).toBe(2);
  });

  it('normalises a yearly subscription into a monthly figure', () => {
    const totals = computeTotals(
      [sub({ amount: 12000, currency: 'EUR', cycle: CYCLE_PRESETS.yearly })],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(1000);
    expect(totals.yearly.amount).toBe(12000);
  });

  it('normalises weekly using the mean year, not 4 weeks', () => {
    // A naive ×4 gives €40.00; the correct figure is 10 × 52.1775 / 12.
    const totals = computeTotals(
      [sub({ amount: 1000, currency: 'EUR', cycle: CYCLE_PRESETS.weekly })],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(4348);
    expect(totals.yearly.amount).toBe(52178);
  });

  it('converts foreign currencies into the home currency', () => {
    // $11.00 at 1.1 USD per EUR = €10.00
    const totals = computeTotals([sub({ amount: 1100, currency: 'USD' })], 'EUR', RATES);
    expect(totals.monthly.amount).toBe(1000);
  });

  it('handles a zero-decimal currency without inventing cents', () => {
    // ¥1600 at 160 JPY per EUR = €10.00
    const totals = computeTotals([sub({ amount: 1600, currency: 'JPY' })], 'EUR', RATES);
    expect(totals.monthly.amount).toBe(1000);
  });

  it('mixes currencies and cycles in one total', () => {
    const totals = computeTotals(
      [
        sub({ amount: 1399, currency: 'EUR' }), // €13.99/mo
        sub({ amount: 1100, currency: 'USD' }), // €10.00/mo
        sub({ amount: 12000, currency: 'EUR', cycle: CYCLE_PRESETS.yearly }), // €10.00/mo
      ],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(3399);
    expect(formatMoney(totals.monthly)).toBe('€33.99');
  });

  it('ignores paused and cancelled subscriptions', () => {
    const totals = computeTotals(
      [
        sub({ amount: 1000, currency: 'EUR' }),
        sub({ amount: 5000, currency: 'EUR', status: 'paused' }),
        sub({ amount: 9000, currency: 'EUR', status: 'cancelled' }),
      ],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(1000);
    expect(totals.counted).toBe(1);
  });

  it('counts trials, since they are about to charge', () => {
    const totals = computeTotals(
      [sub({ amount: 1000, currency: 'EUR', status: 'trial' })],
      'EUR',
      RATES,
    );
    expect(totals.counted).toBe(1);
  });

  it('reports missing rates instead of silently dropping the subscription', () => {
    const totals = computeTotals(
      [sub({ amount: 1000, currency: 'EUR' }), sub({ amount: 5000, currency: 'BRL' })],
      'EUR',
      RATES,
    );
    expect(totals.monthly.amount).toBe(1000);
    expect(totals.counted).toBe(1);
    expect(totals.unconvertible).toEqual(['BRL']);
  });

  it('still totals the home currency when no rate table is loaded', () => {
    const totals = computeTotals(
      [sub({ amount: 1000, currency: 'EUR' }), sub({ amount: 1100, currency: 'USD' })],
      'EUR',
      null,
    );
    expect(totals.monthly.amount).toBe(1000);
    expect(totals.unconvertible).toEqual(['USD']);
  });

  /**
   * The reason totals round once at the end: rounding each subscription first
   * biases the sum. €0.999/mo × 100 is €99.90, not €100.00.
   */
  it('does not accumulate per-subscription rounding bias', () => {
    const many = Array.from({ length: 100 }, () =>
      sub({ amount: 1199, currency: 'EUR', cycle: CYCLE_PRESETS.yearly }),
    );
    const totals = computeTotals(many, 'EUR', RATES);
    // 1199/12 = 99.9166… minor units each; ×100 = 9991.66… → 9992.
    expect(totals.monthly.amount).toBe(9992);
    // Naive per-item rounding would give 100 × 100 = 10000.
    expect(totals.monthly.amount).not.toBe(10000);
    expect(totals.yearly.amount).toBe(119900);
  });
});

describe('totalsByCategory', () => {
  it('groups, sorts by size, and computes shares', () => {
    const result = totalsByCategory(
      [
        sub({ amount: 1000, currency: 'EUR', category: 'Music' }),
        sub({ amount: 2000, currency: 'EUR', category: 'Video' }),
        sub({ amount: 1000, currency: 'EUR', category: 'Video' }),
      ],
      'EUR',
      RATES,
    );
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('Video');
    expect(result[0].monthly.amount).toBe(3000);
    expect(result[0].count).toBe(2);
    expect(result[0].share).toBeCloseTo(0.75, 5);
    expect(result[1].category).toBe('Music');
    expect(result[1].share).toBeCloseTo(0.25, 5);
  });

  it('shares sum to 1', () => {
    const result = totalsByCategory(
      [
        sub({ amount: 333, currency: 'EUR', category: 'A' }),
        sub({ amount: 333, currency: 'EUR', category: 'B' }),
        sub({ amount: 334, currency: 'EUR', category: 'C' }),
      ],
      'EUR',
      RATES,
    );
    const sum = result.reduce((acc, r) => acc + r.share, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('returns an empty list when nothing is billing', () => {
    expect(
      totalsByCategory([sub({ amount: 100, currency: 'EUR', status: 'paused' })], 'EUR', RATES),
    ).toEqual([]);
  });
});

describe('annualSavings', () => {
  it('reports the saving from switching to a yearly plan', () => {
    const monthly = sub({ amount: 1000, currency: 'EUR' }); // €120/yr
    expect(annualSavings(monthly, money(9900, 'EUR')).amount).toBe(2100);
  });

  it('goes negative when the yearly plan is worse', () => {
    const monthly = sub({ amount: 1000, currency: 'EUR' });
    expect(annualSavings(monthly, money(13000, 'EUR')).amount).toBe(-1000);
  });

  it('refuses a cross-currency comparison', () => {
    const monthly = sub({ amount: 1000, currency: 'EUR' });
    expect(() => annualSavings(monthly, money(9900, 'USD'))).toThrow(/like-for-like/);
  });
});
