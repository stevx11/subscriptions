import {
  addDays,
  addMonths,
  addYears,
  compareIsoDate,
  daysBetween,
  daysInMonth,
  formatIsoDate,
  fromEpochDay,
  isLeapYear,
  parseIsoDate,
  toEpochDay,
  todayIso,
} from './date';

describe('parseIsoDate', () => {
  it('parses a valid date', () => {
    expect(parseIsoDate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it.each(['2026-2-8', '26-02-08', '2026/02/08', '', 'tomorrow'])(
    'rejects malformed input %p',
    (value) => {
      expect(() => parseIsoDate(value)).toThrow(/Invalid ISO date/);
    },
  );

  it('rejects impossible calendar dates', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow(/Invalid day/);
    expect(() => parseIsoDate('2026-13-01')).toThrow(/Invalid month/);
  });

  it('accepts Feb 29 only in a leap year', () => {
    expect(parseIsoDate('2028-02-29').day).toBe(29);
    expect(() => parseIsoDate('2026-02-29')).toThrow(/Invalid day/);
  });
});

describe('leap years', () => {
  it.each([
    [2024, true],
    [2026, false],
    [2000, true], // divisible by 400
    [1900, false], // divisible by 100 but not 400
    [2100, false],
  ])('isLeapYear(%i) === %p', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('gives February the right length', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe('addMonths', () => {
  it('adds within a year', () => {
    expect(addMonths('2026-01-15', 2)).toBe('2026-03-15');
  });

  it('rolls over the year boundary', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('goes backwards', () => {
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
  });

  it('clamps the 31st into a 30-day month', () => {
    expect(addMonths('2026-01-31', 3)).toBe('2026-04-30');
  });

  it('clamps the 31st into February', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('is lossy when stepped one month at a time — the reason cycle.ts anchors', () => {
    // Documents the trap: stepping loses the 31st permanently.
    const stepped = addMonths(addMonths('2026-01-31', 1), 1);
    expect(stepped).toBe('2026-03-28');
    // Whereas anchoring from the original keeps it.
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
  });
});

describe('addYears', () => {
  it('moves Feb 29 to Feb 28 in a non-leap year', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
  });

  it('returns Feb 29 across a full leap cycle', () => {
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29');
  });
});

describe('epoch day round-tripping', () => {
  it('anchors the Unix epoch at zero', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(fromEpochDay(0)).toBe('1970-01-01');
  });

  it('handles dates before the epoch', () => {
    expect(fromEpochDay(toEpochDay('1969-07-20'))).toBe('1969-07-20');
  });

  it.each([
    '1900-01-01',
    '1999-12-31',
    '2000-02-29',
    '2026-08-31',
    '2100-03-01',
    '2400-02-29',
  ])('round-trips %s', (date) => {
    expect(fromEpochDay(toEpochDay(date))).toBe(date);
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('goes backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('daysBetween', () => {
  it('counts forwards and backwards symmetrically', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
  });

  it('counts a leap year as 366 days', () => {
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
});

describe('compareIsoDate', () => {
  it('orders dates', () => {
    expect(compareIsoDate('2026-01-01', '2026-06-01')).toBeLessThan(0);
    expect(compareIsoDate('2026-06-01', '2026-01-01')).toBeGreaterThan(0);
    expect(compareIsoDate('2026-06-01', '2026-06-01')).toBe(0);
  });
});

describe('todayIso', () => {
  it('uses local calendar fields, not UTC', () => {
    // 23:30 on the 31st in a timezone ahead of UTC is still the 31st locally,
    // even though the UTC date has already rolled over — the bug this avoids.
    const localLateNight = new Date(2026, 7, 31, 23, 30, 0);
    expect(todayIso(localLateNight)).toBe('2026-08-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatIsoDate', () => {
  it('pads all components', () => {
    expect(formatIsoDate({ year: 26, month: 1, day: 2 })).toBe('0026-01-02');
  });
});
