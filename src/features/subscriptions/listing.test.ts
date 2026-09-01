import { CYCLE_PRESETS } from '@/domain/cycle';
import { money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import {
  filterCounts,
  listSubscriptions,
  matchesFilter,
  matchesQuery,
} from './listing';

const TODAY = '2026-09-01';

function make(overrides: Partial<Subscription> & { name: string }): Subscription {
  return {
    id: overrides.name,
    color: '#000000',
    category: 'Other',
    price: money(1000, 'EUR'),
    cycle: CYCLE_PRESETS.monthly,
    anchorDate: '2026-01-10',
    status: 'active',
    reminderDaysBefore: null,
    priceHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchesFilter', () => {
  it('matches everything under "all"', () => {
    expect(matchesFilter(make({ name: 'a', status: 'cancelled' }), 'all')).toBe(true);
  });

  it('separates active from trial', () => {
    const trial = make({ name: 'a', status: 'trial' });
    expect(matchesFilter(trial, 'active')).toBe(false);
    expect(matchesFilter(trial, 'trial')).toBe(true);
  });

  it('groups paused and cancelled as inactive', () => {
    expect(matchesFilter(make({ name: 'a', status: 'paused' }), 'inactive')).toBe(true);
    expect(matchesFilter(make({ name: 'b', status: 'cancelled' }), 'inactive')).toBe(true);
    expect(matchesFilter(make({ name: 'c', status: 'active' }), 'inactive')).toBe(false);
  });
});

describe('matchesQuery', () => {
  const netflix = make({ name: 'Netflix', category: 'Video', notes: 'family plan' });

  it('matches an empty query', () => {
    expect(matchesQuery(netflix, '   ')).toBe(true);
  });

  it('matches name, category and notes case-insensitively', () => {
    expect(matchesQuery(netflix, 'NETF')).toBe(true);
    expect(matchesQuery(netflix, 'video')).toBe(true);
    expect(matchesQuery(netflix, 'family')).toBe(true);
  });

  it('rejects a non-match', () => {
    expect(matchesQuery(netflix, 'spotify')).toBe(false);
  });

  it('tolerates a missing notes field', () => {
    expect(matchesQuery(make({ name: 'A' }), 'zzz')).toBe(false);
  });
});

describe('listSubscriptions', () => {
  const items = [
    make({ name: 'Zulu', anchorDate: '2026-01-20', price: money(500, 'EUR') }),
    make({ name: 'Alpha', anchorDate: '2026-01-05', price: money(2000, 'EUR') }),
    make({ name: 'Paused', status: 'paused', price: money(9000, 'EUR') }),
  ];

  it('sorts by next charge date by default', () => {
    const result = listSubscriptions(items, { today: TODAY });
    expect(result.map((s) => s.name)).toEqual(['Alpha', 'Zulu', 'Paused']);
  });

  /**
   * The trap this guards against: a subscription that will never charge again
   * has no next date, and a naive comparison sorts null to the front.
   */
  it('sorts never-charging subscriptions to the end, not the front', () => {
    const result = listSubscriptions(items, { sort: 'next', today: TODAY });
    expect(result[result.length - 1].name).toBe('Paused');
  });

  it('sorts by normalised monthly cost, not sticker price', () => {
    // €120/yr is €10/mo, which must rank below a €20/mo subscription.
    const yearly = make({
      name: 'Yearly',
      price: money(12000, 'EUR'),
      cycle: CYCLE_PRESETS.yearly,
    });
    const monthly = make({ name: 'Monthly', price: money(2000, 'EUR') });
    const result = listSubscriptions([yearly, monthly], { sort: 'price', today: TODAY });
    expect(result.map((s) => s.name)).toEqual(['Monthly', 'Yearly']);
  });

  it('puts non-billing subscriptions last when sorting by price', () => {
    const result = listSubscriptions(items, { sort: 'price', today: TODAY });
    expect(result[result.length - 1].name).toBe('Paused');
  });

  it('sorts by name', () => {
    const result = listSubscriptions(items, { sort: 'name', today: TODAY });
    expect(result.map((s) => s.name)).toEqual(['Alpha', 'Paused', 'Zulu']);
  });

  it('sorts by most recently added', () => {
    const older = make({ name: 'Older', createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = make({ name: 'Newer', createdAt: '2026-06-01T00:00:00.000Z' });
    const result = listSubscriptions([older, newer], { sort: 'added', today: TODAY });
    expect(result.map((s) => s.name)).toEqual(['Newer', 'Older']);
  });

  it('applies filter and query together', () => {
    const result = listSubscriptions(items, {
      filter: 'active',
      query: 'a',
      today: TODAY,
    });
    expect(result.map((s) => s.name)).toEqual(['Alpha']);
  });

  it('does not mutate the input array', () => {
    const input = [...items];
    listSubscriptions(input, { sort: 'name', today: TODAY });
    expect(input.map((s) => s.name)).toEqual(['Zulu', 'Alpha', 'Paused']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(listSubscriptions(items, { query: 'nothing', today: TODAY })).toEqual([]);
  });
});

describe('filterCounts', () => {
  it('counts each bucket', () => {
    const counts = filterCounts([
      make({ name: 'a' }),
      make({ name: 'b', status: 'trial' }),
      make({ name: 'c', status: 'paused' }),
      make({ name: 'd', status: 'cancelled' }),
    ]);
    expect(counts).toEqual({ all: 4, active: 1, trial: 1, inactive: 2 });
  });

  it('is all zeros for an empty list', () => {
    expect(filterCounts([])).toEqual({ all: 0, active: 0, trial: 0, inactive: 0 });
  });
});
