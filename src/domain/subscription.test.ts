import { CYCLE_PRESETS } from './cycle';
import { convertMoney, isRateTableStale, MissingRateError, RateTable, tryConvertMoney } from './fx';
import { money } from './money';
import {
  daysUntilNextBilling,
  lastPriceChange,
  monthlyCostMinor,
  nextBillingDate,
  Subscription,
  totalPaidMinor,
  yearlyCostMinor,
} from './subscription';

const RATES: RateTable = {
  base: 'EUR',
  rates: { USD: 1.1, GBP: 0.85, JPY: 160 },
  fetchedAt: '2026-08-31T09:00:00.000Z',
};

function make(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'x',
    name: 'Netflix',
    color: '#E50914',
    category: 'Video',
    price: money(1399, 'EUR'),
    cycle: CYCLE_PRESETS.monthly,
    anchorDate: '2026-01-15',
    status: 'active',
    reminderDaysBefore: null,
    priceHistory: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('nextBillingDate', () => {
  it('finds the next charge for an active subscription', () => {
    expect(nextBillingDate(make(), '2026-08-31')).toBe('2026-09-15');
  });

  it('returns null for paused and cancelled', () => {
    expect(nextBillingDate(make({ status: 'paused' }), '2026-08-31')).toBeNull();
    expect(nextBillingDate(make({ status: 'cancelled' }), '2026-08-31')).toBeNull();
  });

  it('uses the trial end date while in trial — that is the date that stings', () => {
    const trial = make({ status: 'trial', trialEndsAt: '2026-09-05' });
    expect(nextBillingDate(trial, '2026-08-31')).toBe('2026-09-05');
  });

  it('falls back to the cycle once the trial end has passed', () => {
    const trial = make({ status: 'trial', trialEndsAt: '2026-08-01' });
    expect(nextBillingDate(trial, '2026-08-31')).toBe('2026-09-15');
  });

  it('returns the anchor when the first charge is still ahead', () => {
    expect(nextBillingDate(make({ anchorDate: '2026-10-01' }), '2026-08-31')).toBe(
      '2026-10-01',
    );
  });
});

describe('daysUntilNextBilling', () => {
  it('counts days ahead', () => {
    expect(daysUntilNextBilling(make(), '2026-08-31')).toBe(15);
  });

  it('is null when nothing is scheduled', () => {
    expect(daysUntilNextBilling(make({ status: 'cancelled' }), '2026-08-31')).toBeNull();
  });

  it('is 1 the day before a charge', () => {
    expect(daysUntilNextBilling(make(), '2026-09-14')).toBe(1);
  });
});

describe('cost normalisation', () => {
  it('turns a monthly price into a yearly one', () => {
    expect(yearlyCostMinor(make())).toBeCloseTo(16788, 6);
  });

  it('turns a yearly price into a monthly one', () => {
    const annual = make({ price: money(11988, 'EUR'), cycle: CYCLE_PRESETS.yearly });
    expect(monthlyCostMinor(annual)).toBeCloseTo(999, 6);
  });

  it('keeps fractional precision rather than rounding early', () => {
    const annual = make({ price: money(10000, 'EUR'), cycle: CYCLE_PRESETS.yearly });
    // 10000/12 = 833.333… — must NOT come back as a rounded 833.
    expect(monthlyCostMinor(annual)).toBeCloseTo(833.3333, 3);
    expect(Number.isInteger(monthlyCostMinor(annual))).toBe(false);
  });

  it('is zero for anything not billing', () => {
    expect(yearlyCostMinor(make({ status: 'paused' }))).toBe(0);
    expect(monthlyCostMinor(make({ status: 'cancelled' }))).toBe(0);
  });

  it('handles quarterly', () => {
    const q = make({ price: money(3000, 'EUR'), cycle: CYCLE_PRESETS.quarterly });
    expect(yearlyCostMinor(q)).toBeCloseTo(12000, 6);
    expect(monthlyCostMinor(q)).toBeCloseTo(1000, 6);
  });
});

describe('lastPriceChange', () => {
  it('is null without enough history', () => {
    expect(lastPriceChange(make())).toBeNull();
    expect(
      lastPriceChange(make({ priceHistory: [{ since: '2026-01-15', amount: 1199, currency: 'EUR' }] })),
    ).toBeNull();
  });

  it('reports a rise between the last two entries', () => {
    const change = lastPriceChange(
      make({
        priceHistory: [
          { since: '2025-01-15', amount: 1099, currency: 'EUR' },
          { since: '2026-01-15', amount: 1399, currency: 'EUR' },
        ],
      }),
    );
    expect(change).not.toBeNull();
    expect(change!.from.amount).toBe(1099);
    expect(change!.to.amount).toBe(1399);
    expect(change!.since).toBe('2026-01-15');
  });

  it('sorts unordered history before comparing', () => {
    const change = lastPriceChange(
      make({
        priceHistory: [
          { since: '2026-01-15', amount: 1399, currency: 'EUR' },
          { since: '2025-01-15', amount: 1099, currency: 'EUR' },
        ],
      }),
    );
    expect(change!.from.amount).toBe(1099);
  });

  it('is null when the price did not actually move', () => {
    expect(
      lastPriceChange(
        make({
          priceHistory: [
            { since: '2025-01-15', amount: 1399, currency: 'EUR' },
            { since: '2026-01-15', amount: 1399, currency: 'EUR' },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe('fx', () => {
  it('is identity for the same currency', () => {
    expect(convertMoney(money(1399, 'EUR'), 'EUR', RATES)).toEqual(money(1399, 'EUR'));
  });

  it('converts from the base currency', () => {
    expect(convertMoney(money(1000, 'EUR'), 'USD', RATES).amount).toBe(1100);
  });

  it('converts into the base currency', () => {
    expect(convertMoney(money(1100, 'USD'), 'EUR', RATES).amount).toBe(1000);
  });

  it('crosses two non-base currencies', () => {
    // $11.00 → €10.00 → £8.50
    expect(convertMoney(money(1100, 'USD'), 'GBP', RATES).amount).toBe(850);
  });

  it('respects differing minor-unit scales', () => {
    // €10.00 → ¥1600, whole yen, not 160000
    expect(convertMoney(money(1000, 'EUR'), 'JPY', RATES).amount).toBe(1600);
    expect(convertMoney(money(1600, 'JPY'), 'EUR', RATES).amount).toBe(1000);
  });

  it('round-trips within a minor unit', () => {
    const there = convertMoney(money(1399, 'EUR'), 'USD', RATES);
    const back = convertMoney(there, 'EUR', RATES);
    expect(Math.abs(back.amount - 1399)).toBeLessThanOrEqual(1);
  });

  it('throws a typed error for an unknown rate', () => {
    expect(() => convertMoney(money(100, 'BRL'), 'EUR', RATES)).toThrow(MissingRateError);
  });

  it('tryConvertMoney returns null rather than throwing', () => {
    expect(tryConvertMoney(money(100, 'BRL'), 'EUR', RATES)).toBeNull();
    expect(tryConvertMoney(money(100, 'EUR'), 'EUR', null)).toEqual(money(100, 'EUR'));
    expect(tryConvertMoney(money(100, 'USD'), 'EUR', null)).toBeNull();
  });

  it('detects stale rates', () => {
    const justAfter = new Date('2026-08-31T10:00:00.000Z');
    const muchLater = new Date('2026-09-02T10:00:00.000Z');
    expect(isRateTableStale(RATES, 24, justAfter)).toBe(false);
    expect(isRateTableStale(RATES, 24, muchLater)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isRateTableStale({ ...RATES, fetchedAt: 'never' })).toBe(true);
  });
});

describe('totalPaidMinor', () => {
  it('counts every monthly charge since the anchor', () => {
    const result = totalPaidMinor(make({ anchorDate: '2026-01-15' }), '2026-09-01');
    expect(result.charges).toBe(8); // Jan through Aug
    expect(result.amountMinor).toBe(8 * 1399);
  });

  it('counts a yearly plan in years, not months', () => {
    const yearly = make({
      cycle: CYCLE_PRESETS.yearly,
      anchorDate: '2023-06-10',
      price: money(28900, 'EUR'),
    });
    expect(totalPaidMinor(yearly, '2026-09-01').charges).toBe(4); // 2023-2026
  });

  it('includes a charge landing exactly today', () => {
    expect(totalPaidMinor(make({ anchorDate: '2026-09-01' }), '2026-09-01').charges).toBe(1);
  });

  it('is zero before billing starts', () => {
    const result = totalPaidMinor(make({ anchorDate: '2026-12-01' }), '2026-09-01');
    expect(result).toEqual({ amountMinor: 0, charges: 0 });
  });

  it('stops counting at the cancellation date', () => {
    const cancelled = make({
      anchorDate: '2026-01-15',
      status: 'cancelled',
      cancelledAt: '2026-04-01',
    });
    expect(totalPaidMinor(cancelled, '2026-09-01').charges).toBe(3); // Jan, Feb, Mar
  });

  it('starts a trial at its conversion date, not its creation', () => {
    const trial = make({
      status: 'trial',
      trialEndsAt: '2026-08-20',
      anchorDate: '2026-08-20',
    });
    expect(totalPaidMinor(trial, '2026-09-01').charges).toBe(1);
  });
});
