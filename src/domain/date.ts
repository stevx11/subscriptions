/**
 * Calendar-date arithmetic, deliberately independent of `Date`'s timezone
 * behaviour.
 *
 * A billing date is a *calendar date*, not an instant: "Netflix charges me on
 * the 12th" is true regardless of timezone, DST, or what hour it is. Modelling
 * it as a `Date` invites the classic off-by-one-day bug where a local-midnight
 * Date shifts to the previous day once serialised as UTC.
 *
 * So dates are plain `YYYY-MM-DD` strings here, and all arithmetic runs on
 * integer year/month/day triples. No `Date` object ever holds app state.
 */

/** A calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string;

export interface DateParts {
  year: number;
  month: number; // 1-12, not 0-indexed
  day: number; // 1-31
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): DateParts {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new Error(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in ${value}`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid day in ${value}`);
  }
  return { year, month, day };
}

export function formatIsoDate(parts: DateParts): IsoDate {
  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Add whole months, clamping the day to the target month's length.
 * Jan 31 + 1 month = Feb 28 (or Feb 29 in a leap year).
 *
 * Note this is intentionally *lossy*: the original day-of-month is not
 * recoverable from the result. Repeated single-step calls therefore drift
 * (Jan 31 → Feb 28 → Mar 28), which is why `cycle.ts` always computes
 * occurrences from the original anchor rather than by stepping.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatIsoDate({ year: targetYear, month: targetMonth, day: clampedDay });
}

export function addYears(date: IsoDate, years: number): IsoDate {
  return addMonths(date, years * 12);
}

/** Days since the Unix epoch. Pure integer maths, no `Date`. */
export function toEpochDay(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  // Howard Hinnant's civil-from-days algorithm, inverted.
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(epochDay: number): IsoDate {
  let z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return formatIsoDate({ year: month <= 2 ? y + 1 : y, month, day });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

export function addWeeks(date: IsoDate, weeks: number): IsoDate {
  return addDays(date, weeks * 7);
}

/** Whole days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return toEpochDay(b) - toEpochDay(a);
}

/** Negative when `a` < `b`, 0 when equal, positive when `a` > `b`. */
export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

export function minIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDate(a, b) <= 0 ? a : b;
}

export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDate(a, b) >= 0 ? a : b;
}

/**
 * Today's calendar date in the device's local timezone.
 *
 * This is the one place local time legitimately enters the domain: "is this
 * subscription due today" must mean the user's today, not UTC's. Callers that
 * need determinism (tests, pure computations) should pass an explicit date
 * instead of calling this.
 */
export function todayIso(now: Date = new Date()): IsoDate {
  return formatIsoDate({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}
