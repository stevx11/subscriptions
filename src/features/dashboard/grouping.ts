/**
 * How the upcoming list is divided up.
 *
 * Pure so the boundaries are testable — off-by-one errors around "this week"
 * and month ends are exactly the kind of thing that looks fine in a screenshot
 * and is wrong on the 29th.
 */

import { isSameMonth, IsoDate } from '@/domain/date';

export type BucketId = 'week' | 'month' | 'later';

export const BUCKET_LABELS: Record<BucketId, string> = {
  week: 'Next 7 days',
  month: 'Later this month',
  later: 'Further out',
};

/**
 * Anything within a week is imminent regardless of month. Beyond that, the
 * calendar month is the unit people budget in, so a charge on the 30th reads
 * differently from one on the 2nd even though they are two days apart.
 */
export function bucketFor(date: IsoDate, days: number, today: IsoDate): BucketId {
  if (days <= 7) {
    return 'week';
  }
  return isSameMonth(date, today) ? 'month' : 'later';
}

export interface Grouped<T> {
  id: BucketId;
  label: string;
  entries: T[];
}

/**
 * Bucket entries in order, dropping empty groups so the screen never shows a
 * heading with nothing under it.
 */
export function groupUpcoming<T extends { date: IsoDate | null; days: number }>(
  entries: readonly T[],
  today: IsoDate,
): Grouped<T>[] {
  const buckets: Record<BucketId, T[]> = { week: [], month: [], later: [] };

  for (const entry of entries) {
    if (entry.date === null) continue;
    buckets[bucketFor(entry.date, entry.days, today)].push(entry);
  }

  return (['week', 'month', 'later'] as const)
    .map((id) => ({ id, label: BUCKET_LABELS[id], entries: buckets[id] }))
    .filter((group) => group.entries.length > 0);
}
