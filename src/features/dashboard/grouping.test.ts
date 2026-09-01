import { bucketFor, groupUpcoming } from './grouping';

const TODAY = '2026-09-10';

describe('bucketFor', () => {
  it('treats anything within a week as imminent', () => {
    expect(bucketFor('2026-09-10', 0, TODAY)).toBe('week');
    expect(bucketFor('2026-09-17', 7, TODAY)).toBe('week');
  });

  it('puts the rest of the current month in its own bucket', () => {
    expect(bucketFor('2026-09-18', 8, TODAY)).toBe('month');
    expect(bucketFor('2026-09-30', 20, TODAY)).toBe('month');
  });

  it('pushes next month out even when it is only days away', () => {
    // The 1st of October is two days after the 29th of September, but people
    // budget by calendar month, so it belongs in a different group.
    expect(bucketFor('2026-10-01', 21, TODAY)).toBe('later');
  });

  /**
   * The boundary case that motivates the week-first rule: late in the month,
   * a charge four days out lands in the *next* month but is still imminent.
   */
  it('keeps a genuinely imminent charge imminent across a month boundary', () => {
    expect(bucketFor('2026-10-02', 3, '2026-09-29')).toBe('week');
  });

  it('handles a year boundary', () => {
    expect(bucketFor('2027-01-05', 25, '2026-12-11')).toBe('later');
  });

  it('does not confuse the same month in different years', () => {
    expect(bucketFor('2027-09-15', 370, TODAY)).toBe('later');
  });
});

describe('groupUpcoming', () => {
  const entry = (date: string, days: number) => ({ date, days });

  it('orders groups imminent-first', () => {
    const groups = groupUpcoming(
      [entry('2026-10-20', 40), entry('2026-09-12', 2), entry('2026-09-25', 15)],
      TODAY,
    );
    expect(groups.map((g) => g.id)).toEqual(['week', 'month', 'later']);
  });

  it('omits empty groups rather than showing a bare heading', () => {
    const groups = groupUpcoming([entry('2026-09-12', 2)], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('week');
  });

  it('returns nothing for an empty list', () => {
    expect(groupUpcoming([], TODAY)).toEqual([]);
  });

  it('skips entries with no date rather than crashing', () => {
    const groups = groupUpcoming([{ date: null, days: 0 }, entry('2026-09-12', 2)], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(1);
  });

  it('preserves the order it was given within a group', () => {
    const groups = groupUpcoming([entry('2026-09-11', 1), entry('2026-09-13', 3)], TODAY);
    expect(groups[0].entries.map((e) => e.date)).toEqual(['2026-09-11', '2026-09-13']);
  });
});
