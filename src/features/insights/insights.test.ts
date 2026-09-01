import { BillingCycle, CYCLE_PRESETS } from '@/domain/cycle';
import { CurrencyCode } from '@/domain/currency';
import { RateTable } from '@/domain/fx';
import { money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import {
  categoryBreakdown,
  monthlySpend,
  mostExpensive,
  priceRises,
  rarelyUsed,
} from './insights';

const TODAY = '2026-09-15';

const RATES: RateTable = {
  base: 'EUR',
  rates: { USD: 1.1, GBP: 0.85 },
  fetchedAt: '2026-09-01T00:00:00.000Z',
};

function sub(
  overrides: Partial<Subscription> & { amount: number; currency: CurrencyCode; id: string },
): Subscription {
  const { amount, currency, ...rest } = overrides;
  return {
    name: rest.name ?? 'Test',
    color: '#000000',
    category: rest.category ?? 'Other',
    price: money(amount, currency),
    cycle: (rest.cycle as BillingCycle) ?? CYCLE_PRESETS.monthly,
    anchorDate: rest.anchorDate ?? '2026-01-10',
    status: rest.status ?? 'active',
    reminderDaysBefore: null,
    priceHistory: [],
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...rest,
  };
}

describe('monthlySpend', () => {
  it('returns one point per month across the window', () => {
    const points = monthlySpend([], 'EUR', RATES, TODAY, 5, 6);
    expect(points).toHaveLength(12);
  });

  it('marks only future months as projected', () => {
    const points = monthlySpend([], 'EUR', RATES, TODAY, 2, 2);
    expect(points.map((p) => p.projected)).toEqual([false, false, false, true, true]);
  });

  it('starts each point on the first of the month', () => {
    const points = monthlySpend([], 'EUR', RATES, TODAY, 1, 1);
    expect(points.map((p) => p.month)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('spreads a monthly subscription evenly', () => {
    const points = monthlySpend(
      [sub({ id: 'a', amount: 1000, currency: 'EUR', anchorDate: '2026-01-10' })],
      'EUR',
      RATES,
      TODAY,
      2,
      2,
    );
    for (const point of points) {
      expect(point.total.amount).toBe(1000);
      expect(point.count).toBe(1);
    }
  });

  /**
   * The reason this uses real charge dates rather than the amortised average:
   * a yearly plan is one tall bar, not a flat smear across twelve months.
   */
  it('puts a yearly plan entirely in its billing month', () => {
    const yearly = sub({
      id: 'a',
      amount: 12000,
      currency: 'EUR',
      cycle: CYCLE_PRESETS.yearly,
      anchorDate: '2025-10-05',
    });
    const points = monthlySpend([yearly], 'EUR', RATES, TODAY, 1, 2);
    const october = points.find((p) => p.month === '2026-10-01');
    const september = points.find((p) => p.month === '2026-09-01');
    expect(october!.total.amount).toBe(12000);
    expect(september!.total.amount).toBe(0);
  });

  it('converts foreign currencies', () => {
    const points = monthlySpend(
      [sub({ id: 'a', amount: 1100, currency: 'USD' })],
      'EUR',
      RATES,
      TODAY,
      0,
      0,
    );
    expect(points[0].total.amount).toBe(1000);
  });
});

describe('mostExpensive', () => {
  it('ranks by yearly cost, not sticker price', () => {
    const monthly = sub({ id: 'm', name: 'Monthly', amount: 2000, currency: 'EUR' });
    const yearly = sub({
      id: 'y',
      name: 'Yearly',
      amount: 12000,
      currency: 'EUR',
      cycle: CYCLE_PRESETS.yearly,
    });
    const result = mostExpensive([yearly, monthly], 'EUR', RATES);
    // €20/mo is €240/yr, which beats €120/yr despite the smaller number.
    expect(result.map((r) => r.subscription.name)).toEqual(['Monthly', 'Yearly']);
  });

  it('computes shares that sum to 1', () => {
    const result = mostExpensive(
      [
        sub({ id: 'a', amount: 1000, currency: 'EUR' }),
        sub({ id: 'b', amount: 3000, currency: 'EUR' }),
      ],
      'EUR',
      RATES,
    );
    expect(result.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 10);
    expect(result[0].share).toBeCloseTo(0.75, 6);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      sub({ id: `s${i}`, amount: 1000 + i, currency: 'EUR' }),
    );
    expect(mostExpensive(many, 'EUR', RATES, 3)).toHaveLength(3);
  });

  it('ignores paused subscriptions', () => {
    const result = mostExpensive(
      [sub({ id: 'a', amount: 9000, currency: 'EUR', status: 'paused' })],
      'EUR',
      RATES,
    );
    expect(result).toEqual([]);
  });

  it('skips subscriptions it cannot convert rather than misranking them', () => {
    const result = mostExpensive(
      [
        sub({ id: 'a', amount: 1000, currency: 'EUR' }),
        sub({ id: 'b', amount: 5000, currency: 'BRL' }),
      ],
      'EUR',
      RATES,
    );
    expect(result.map((r) => r.subscription.id)).toEqual(['a']);
  });
});

describe('priceRises', () => {
  const withHistory = (id: string, from: number, to: number, since: string) =>
    sub({
      id,
      amount: to,
      currency: 'EUR',
      priceHistory: [
        { since: '2025-01-01', amount: from, currency: 'EUR' },
        { since, amount: to, currency: 'EUR' },
      ],
    });

  it('reports a rise with its percentage', () => {
    const result = priceRises([withHistory('a', 1000, 1200, '2026-06-01')]);
    expect(result).toHaveLength(1);
    expect(result[0].fraction).toBeCloseTo(0.2, 6);
    expect(result[0].since).toBe('2026-06-01');
  });

  it('ignores price drops', () => {
    expect(priceRises([withHistory('a', 1200, 1000, '2026-06-01')])).toEqual([]);
  });

  it('ignores subscriptions with no history', () => {
    expect(priceRises([sub({ id: 'a', amount: 1000, currency: 'EUR' })])).toEqual([]);
  });

  it('sorts most recent first', () => {
    const result = priceRises([
      withHistory('old', 1000, 1100, '2026-01-01'),
      withHistory('new', 1000, 1100, '2026-08-01'),
    ]);
    expect(result.map((r) => r.subscription.id)).toEqual(['new', 'old']);
  });

  /** A percentage across two different currencies would be meaningless. */
  it('skips a change that also switched currency', () => {
    const s = sub({
      id: 'a',
      amount: 1200,
      currency: 'USD',
      priceHistory: [
        { since: '2025-01-01', amount: 1000, currency: 'EUR' },
        { since: '2026-06-01', amount: 1200, currency: 'USD' },
      ],
    });
    expect(priceRises([s])).toEqual([]);
  });

  it('does not divide by zero on a free-to-paid change', () => {
    const s = sub({
      id: 'a',
      amount: 999,
      currency: 'EUR',
      priceHistory: [
        { since: '2025-01-01', amount: 0, currency: 'EUR' },
        { since: '2026-06-01', amount: 999, currency: 'EUR' },
      ],
    });
    expect(priceRises([s])).toEqual([]);
  });
});

describe('rarelyUsed', () => {
  it('picks up only low usage ratings', () => {
    const result = rarelyUsed(
      [
        sub({ id: 'a', amount: 1000, currency: 'EUR', usageRating: 0 }),
        sub({ id: 'b', amount: 1000, currency: 'EUR', usageRating: 1 }),
        sub({ id: 'c', amount: 1000, currency: 'EUR', usageRating: 3 }),
        sub({ id: 'd', amount: 1000, currency: 'EUR' }),
      ],
      'EUR',
      RATES,
    );
    expect(result.map((r) => r.subscription.id).sort()).toEqual(['a', 'b']);
  });

  it('is empty when nothing has been rated', () => {
    expect(rarelyUsed([sub({ id: 'a', amount: 1000, currency: 'EUR' })], 'EUR', RATES)).toEqual(
      [],
    );
  });
});

describe('categoryBreakdown', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      sub({ id: `s${i}`, amount: (count - i) * 100, currency: 'EUR', category: `C${i}` }),
    );

  it('returns everything when under the cap', () => {
    expect(categoryBreakdown(many(4), 'EUR', RATES, 6)).toHaveLength(4);
  });

  it('folds the tail into a single Other bar', () => {
    const result = categoryBreakdown(many(10), 'EUR', RATES, 6);
    expect(result).toHaveLength(6);
    expect(result[result.length - 1].category).toBe('Other');
  });

  it('keeps the total intact when folding', () => {
    const full = categoryBreakdown(many(10), 'EUR', RATES, 20);
    const capped = categoryBreakdown(many(10), 'EUR', RATES, 6);
    const sum = (rows: { monthly: { amount: number } }[]) =>
      rows.reduce((total, row) => total + row.monthly.amount, 0);
    expect(sum(capped)).toBe(sum(full));
  });

  it('counts every subscription in the Other bucket', () => {
    const result = categoryBreakdown(many(10), 'EUR', RATES, 6);
    const totalCount = result.reduce((sum, row) => sum + row.count, 0);
    expect(totalCount).toBe(10);
  });
});
