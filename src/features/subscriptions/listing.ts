/**
 * Sorting, filtering and searching for the subscriptions list.
 *
 * Pure, because these are the rules most likely to be quietly wrong — a sort
 * that puts paused items in the middle of the upcoming order, or a filter that
 * counts cancelled subscriptions in the total, looks fine until you notice it.
 */

import { IsoDate, todayIso } from '@/domain/date';
import {
  isBilling,
  monthlyCostMinor,
  nextBillingDate,
  Subscription,
} from '@/domain/subscription';

export type SortKey = 'next' | 'price' | 'name' | 'added';
export type StatusFilter = 'all' | 'active' | 'trial' | 'inactive';

export const SORT_LABELS: Record<SortKey, string> = {
  next: 'Next charge',
  price: 'Most expensive',
  name: 'Name',
  added: 'Recently added',
};

export const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  trial: 'Trials',
  inactive: 'Paused',
};

export function matchesFilter(subscription: Subscription, filter: StatusFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return subscription.status === 'active';
    case 'trial':
      return subscription.status === 'trial';
    case 'inactive':
      return subscription.status === 'paused' || subscription.status === 'cancelled';
  }
}

/** Case-insensitive match across the name, category and notes. */
export function matchesQuery(subscription: Subscription, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    subscription.name.toLowerCase().includes(needle) ||
    subscription.category.toLowerCase().includes(needle) ||
    (subscription.notes ?? '').toLowerCase().includes(needle)
  );
}

/**
 * Compare by the chosen key.
 *
 * "Next charge" has to handle subscriptions that will never charge again:
 * paused and cancelled ones sort to the end rather than to the front, which is
 * what a naive null-as-zero comparison would do.
 */
function compare(
  a: Subscription,
  b: Subscription,
  key: SortKey,
  today: IsoDate,
): number {
  switch (key) {
    case 'next': {
      const dateA = nextBillingDate(a, today);
      const dateB = nextBillingDate(b, today);
      if (dateA === null && dateB === null) return a.name.localeCompare(b.name);
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA === dateB ? a.name.localeCompare(b.name) : dateA < dateB ? -1 : 1;
    }
    case 'price': {
      // Compares normalised monthly cost, so a yearly plan is not judged
      // against a monthly one on sticker price alone.
      const costA = isBilling(a) ? monthlyCostMinor(a) : -1;
      const costB = isBilling(b) ? monthlyCostMinor(b) : -1;
      return costB - costA || a.name.localeCompare(b.name);
    }
    case 'name':
      return a.name.localeCompare(b.name);
    case 'added':
      return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name);
  }
}

export interface ListOptions {
  query?: string;
  filter?: StatusFilter;
  sort?: SortKey;
  today?: IsoDate;
}

export function listSubscriptions(
  subscriptions: readonly Subscription[],
  options: ListOptions = {},
): Subscription[] {
  const { query = '', filter = 'all', sort = 'next', today = todayIso() } = options;

  return subscriptions
    .filter((s) => matchesFilter(s, filter) && matchesQuery(s, query))
    .sort((a, b) => compare(a, b, sort, today));
}

/** Counts per filter, for the chips to show how much is behind each one. */
export function filterCounts(
  subscriptions: readonly Subscription[],
): Record<StatusFilter, number> {
  return {
    all: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'active').length,
    trial: subscriptions.filter((s) => s.status === 'trial').length,
    inactive: subscriptions.filter((s) => s.status === 'paused' || s.status === 'cancelled')
      .length,
  };
}
