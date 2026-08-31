import {
  BillingCycle,
  CYCLE_PRESETS,
  describeCycle,
  lastOccurrenceOnOrBefore,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesBetween,
  occurrencesPerYear,
} from './cycle';

const monthly: BillingCycle = CYCLE_PRESETS.monthly;
const yearly: BillingCycle = CYCLE_PRESETS.yearly;
const weekly: BillingCycle = CYCLE_PRESETS.weekly;
const quarterly: BillingCycle = CYCLE_PRESETS.quarterly;

describe('occurrenceAt', () => {
  it('returns the anchor at n = 0', () => {
    expect(occurrenceAt('2026-03-15', monthly, 0)).toBe('2026-03-15');
  });

  it('steps monthly', () => {
    expect(occurrenceAt('2026-03-15', monthly, 4)).toBe('2026-07-15');
  });

  it('steps quarterly', () => {
    expect(occurrenceAt('2026-01-10', quarterly, 2)).toBe('2026-07-10');
  });

  it('steps weekly', () => {
    expect(occurrenceAt('2026-03-02', weekly, 3)).toBe('2026-03-23');
  });

  it('steps yearly', () => {
    expect(occurrenceAt('2026-03-15', yearly, 2)).toBe('2028-03-15');
  });

  /**
   * The headline bug this module exists to prevent. Billing on the 31st must
   * recover the 31st in every long month, not degrade to the 28th forever.
   */
  it('keeps a 31st anchor across February', () => {
    const anchor = '2026-01-31';
    expect(occurrenceAt(anchor, monthly, 0)).toBe('2026-01-31');
    expect(occurrenceAt(anchor, monthly, 1)).toBe('2026-02-28'); // clamped
    expect(occurrenceAt(anchor, monthly, 2)).toBe('2026-03-31'); // recovered
    expect(occurrenceAt(anchor, monthly, 3)).toBe('2026-04-30'); // clamped
    expect(occurrenceAt(anchor, monthly, 4)).toBe('2026-05-31'); // recovered
  });

  it('keeps a Feb 29 anchor across non-leap years', () => {
    const anchor = '2028-02-29';
    expect(occurrenceAt(anchor, yearly, 1)).toBe('2029-02-28');
    expect(occurrenceAt(anchor, yearly, 4)).toBe('2032-02-29');
  });

  it('rejects a nonsense interval', () => {
    expect(() => occurrenceAt('2026-01-01', { unit: 'month', interval: 0 }, 1)).toThrow(
      /positive integer/,
    );
    expect(() => occurrenceAt('2026-01-01', { unit: 'month', interval: 1.5 }, 1)).toThrow(
      /positive integer/,
    );
  });
});

describe('nextOccurrenceAfter', () => {
  it('returns the anchor when billing has not started', () => {
    expect(nextOccurrenceAfter('2026-12-01', monthly, '2026-08-31')).toBe('2026-12-01');
  });

  it('finds the next date mid-cycle', () => {
    expect(nextOccurrenceAfter('2026-01-15', monthly, '2026-08-31')).toBe('2026-09-15');
  });

  it('is strictly after — a charge today means the next one is next cycle', () => {
    expect(nextOccurrenceAfter('2026-01-15', monthly, '2026-08-15')).toBe('2026-09-15');
  });

  it('returns the day after correctly on a boundary', () => {
    expect(nextOccurrenceAfter('2026-01-15', monthly, '2026-08-14')).toBe('2026-08-15');
  });

  it('handles a 31st anchor landing in a short month', () => {
    expect(nextOccurrenceAfter('2026-01-31', monthly, '2026-02-15')).toBe('2026-02-28');
    expect(nextOccurrenceAfter('2026-01-31', monthly, '2026-02-28')).toBe('2026-03-31');
  });

  it('handles yearly across many years', () => {
    expect(nextOccurrenceAfter('2020-06-10', yearly, '2026-08-31')).toBe('2027-06-10');
  });

  it('handles weekly', () => {
    expect(nextOccurrenceAfter('2026-08-03', weekly, '2026-08-31')).toBe('2026-09-07');
  });

  it('handles a daily cycle far from the anchor', () => {
    const daily: BillingCycle = { unit: 'day', interval: 1 };
    expect(nextOccurrenceAfter('2020-01-01', daily, '2026-08-31')).toBe('2026-09-01');
  });

  it('agrees with brute-force stepping over a long monthly run', () => {
    // Independent check: walk occurrences until passing the reference date.
    const anchor = '2021-01-31';
    const reference = '2026-08-31';
    let n = 0;
    while (occurrenceAt(anchor, monthly, n) <= reference) n += 1;
    expect(nextOccurrenceAfter(anchor, monthly, reference)).toBe(
      occurrenceAt(anchor, monthly, n),
    );
  });
});

describe('lastOccurrenceOnOrBefore', () => {
  it('returns null before billing starts', () => {
    expect(lastOccurrenceOnOrBefore('2026-12-01', monthly, '2026-08-31')).toBeNull();
  });

  it('returns the anchor on the anchor date', () => {
    expect(lastOccurrenceOnOrBefore('2026-08-31', monthly, '2026-08-31')).toBe(
      '2026-08-31',
    );
  });

  it('finds the most recent charge', () => {
    expect(lastOccurrenceOnOrBefore('2026-01-15', monthly, '2026-08-31')).toBe(
      '2026-08-15',
    );
  });

  it('pairs consistently with nextOccurrenceAfter', () => {
    const anchor = '2024-03-31';
    const reference = '2026-08-31';
    const last = lastOccurrenceOnOrBefore(anchor, monthly, reference)!;
    const next = nextOccurrenceAfter(anchor, monthly, reference);
    expect(last <= reference).toBe(true);
    expect(next > reference).toBe(true);
  });
});

describe('occurrencesBetween', () => {
  it('lists monthly charges in a window', () => {
    expect(occurrencesBetween('2026-01-15', monthly, '2026-03-01', '2026-06-01')).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
    ]);
  });

  it('includes both endpoints when they fall on charges', () => {
    expect(occurrencesBetween('2026-01-15', monthly, '2026-02-15', '2026-04-15')).toEqual([
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
  });

  it('returns nothing for an inverted window', () => {
    expect(occurrencesBetween('2026-01-15', monthly, '2026-06-01', '2026-03-01')).toEqual(
      [],
    );
  });

  it('returns nothing when the window predates the anchor', () => {
    expect(occurrencesBetween('2026-05-01', monthly, '2026-01-01', '2026-04-01')).toEqual(
      [],
    );
  });

  it('handles a window spanning a clamped month', () => {
    expect(occurrencesBetween('2026-01-31', monthly, '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
});

describe('occurrencesPerYear', () => {
  it('is 12 for monthly and 1 for yearly', () => {
    expect(occurrencesPerYear(monthly)).toBe(12);
    expect(occurrencesPerYear(yearly)).toBe(1);
  });

  it('is 4 for quarterly', () => {
    expect(occurrencesPerYear(quarterly)).toBe(4);
  });

  it('uses the mean Gregorian year for weekly', () => {
    expect(occurrencesPerYear(weekly)).toBeCloseTo(52.1775, 4);
  });

  it('scales inversely with the interval', () => {
    expect(occurrencesPerYear({ unit: 'month', interval: 2 })).toBe(6);
  });
});

describe('describeCycle', () => {
  it.each([
    [CYCLE_PRESETS.monthly, 'Monthly'],
    [CYCLE_PRESETS.yearly, 'Yearly'],
    [CYCLE_PRESETS.weekly, 'Weekly'],
    [CYCLE_PRESETS.quarterly, 'Quarterly'],
    [CYCLE_PRESETS.semiannual, 'Every 6 months'],
    [CYCLE_PRESETS.fortnightly, 'Fortnightly'],
  ])('describes %o as %s', (cycle, expected) => {
    expect(describeCycle(cycle)).toBe(expected);
  });

  it('falls back to a generic phrase', () => {
    expect(describeCycle({ unit: 'day', interval: 10 })).toBe('Every 10 days');
  });
});
