/**
 * Backup and restore.
 *
 * This matters more here than in most apps. A sideloaded app signed with a free
 * Apple ID is re-signed every seven days, and a failed refresh can take the
 * app's storage with it. The user's data lives on exactly one device with no
 * server behind it, so an export is the only thing standing between a bad
 * re-sign and re-entering everything by hand.
 *
 * Parsing is therefore paranoid and pure: a restore either produces a complete,
 * valid set of subscriptions or it fails loudly. Half-importing a malformed
 * backup over good data would be the worst possible outcome.
 */

import { CURRENCIES, isCurrencyCode } from '@/domain/currency';
import { Subscription, SubscriptionStatus } from '@/domain/subscription';
import { DEFAULT_SETTINGS, Settings } from '@/data/settings';

export const BACKUP_FORMAT = 'subscriptions-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  subscriptions: Subscription[];
  settings: Settings;
}

export interface RestoreResult {
  subscriptions: Subscription[];
  settings: Settings;
  /** Entries dropped because they were not usable, with the reason. */
  skipped: string[];
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function exportBackup(
  subscriptions: readonly Subscription[],
  settings: Settings,
  now: Date = new Date(),
): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    subscriptions: [...subscriptions],
    settings,
  };
  // Pretty-printed: a backup someone may open in a text editor to check it is
  // not empty is worth more than a few saved bytes.
  return JSON.stringify(file, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `subscriptions-${stamp}.json`;
}

const VALID_STATUS = new Set<SubscriptionStatus>([
  'active',
  'trial',
  'paused',
  'cancelled',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate one subscription from a backup.
 * Returns null with a reason rather than throwing, so one bad row does not
 * discard an otherwise good backup.
 */
function parseSubscription(raw: unknown, index: number): Subscription | string {
  if (!isRecord(raw)) {
    return `Entry ${index + 1} is not an object`;
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') {
    return `Entry ${index + 1} has no name`;
  }

  const price = raw.price;
  if (
    !isRecord(price) ||
    typeof price.amount !== 'number' ||
    !Number.isInteger(price.amount) ||
    typeof price.currency !== 'string' ||
    !isCurrencyCode(price.currency)
  ) {
    return `${name} has an unusable price`;
  }

  const cycle = raw.cycle;
  if (
    !isRecord(cycle) ||
    typeof cycle.interval !== 'number' ||
    !Number.isInteger(cycle.interval) ||
    cycle.interval < 1 ||
    !['day', 'week', 'month', 'year'].includes(String(cycle.unit))
  ) {
    return `${name} has an unusable billing cycle`;
  }

  if (typeof raw.anchorDate !== 'string' || !ISO_DATE.test(raw.anchorDate)) {
    return `${name} has an unusable start date`;
  }

  const status = VALID_STATUS.has(raw.status as SubscriptionStatus)
    ? (raw.status as SubscriptionStatus)
    : 'active';

  const history = Array.isArray(raw.priceHistory)
    ? raw.priceHistory.filter(
        (point): point is { since: string; amount: number; currency: string } =>
          isRecord(point) &&
          typeof point.since === 'string' &&
          ISO_DATE.test(point.since) &&
          typeof point.amount === 'number' &&
          Number.isInteger(point.amount) &&
          typeof point.currency === 'string' &&
          isCurrencyCode(point.currency),
      )
    : [];

  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : `restored-${index}`,
    name,
    brandId: typeof raw.brandId === 'string' ? raw.brandId : undefined,
    color: typeof raw.color === 'string' ? raw.color : '#5B8DEF',
    category: typeof raw.category === 'string' ? raw.category : 'Other',
    price: { amount: price.amount, currency: price.currency },
    cycle: {
      unit: cycle.unit as 'day' | 'week' | 'month' | 'year',
      interval: cycle.interval,
    },
    anchorDate: raw.anchorDate,
    status,
    trialEndsAt:
      typeof raw.trialEndsAt === 'string' && ISO_DATE.test(raw.trialEndsAt)
        ? raw.trialEndsAt
        : undefined,
    cancelledAt:
      typeof raw.cancelledAt === 'string' && ISO_DATE.test(raw.cancelledAt)
        ? raw.cancelledAt
        : undefined,
    reminderDaysBefore:
      typeof raw.reminderDaysBefore === 'number' ? raw.reminderDaysBefore : null,
    usageRating: typeof raw.usageRating === 'number' ? raw.usageRating : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    cancelUrl: typeof raw.cancelUrl === 'string' ? raw.cancelUrl : undefined,
    priceHistory: history.map((point) => ({
      since: point.since,
      amount: point.amount,
      currency: point.currency as Subscription['price']['currency'],
    })),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) {
    return DEFAULT_SETTINGS;
  }
  const homeCurrency =
    typeof raw.homeCurrency === 'string' && isCurrencyCode(raw.homeCurrency)
      ? raw.homeCurrency
      : DEFAULT_SETTINGS.homeCurrency;

  const hour =
    typeof raw.reminderHour === 'number' && raw.reminderHour >= 0 && raw.reminderHour <= 23
      ? Math.floor(raw.reminderHour)
      : DEFAULT_SETTINGS.reminderHour;

  return {
    homeCurrency,
    defaultReminderDays:
      typeof raw.defaultReminderDays === 'number' && raw.defaultReminderDays >= 0
        ? Math.floor(raw.defaultReminderDays)
        : DEFAULT_SETTINGS.defaultReminderDays,
    remindersEnabled:
      typeof raw.remindersEnabled === 'boolean'
        ? raw.remindersEnabled
        : DEFAULT_SETTINGS.remindersEnabled,
    reminderHour: hour,
  };
}

/**
 * Parse a backup file.
 *
 * Throws for anything that is not recognisably one of our backups — importing
 * an arbitrary JSON file should fail with a clear message rather than wiping
 * the user's data with nothing.
 */
export function parseBackup(contents: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new BackupError('That file is not a subscriptions backup.');
  }
  if (parsed.format !== BACKUP_FORMAT) {
    throw new BackupError('That file is not a subscriptions backup.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new BackupError(
      'That backup was made by a newer version of the app than this one.',
    );
  }
  if (!Array.isArray(parsed.subscriptions)) {
    throw new BackupError('That backup has no subscriptions in it.');
  }

  const subscriptions: Subscription[] = [];
  const skipped: string[] = [];

  parsed.subscriptions.forEach((raw, index) => {
    const result = parseSubscription(raw, index);
    if (typeof result === 'string') {
      skipped.push(result);
    } else {
      subscriptions.push(result);
    }
  });

  if (subscriptions.length === 0) {
    throw new BackupError('No usable subscriptions were found in that backup.');
  }

  return { subscriptions, settings: parseSettings(parsed.settings), skipped };
}

/** Human summary for the confirmation dialog before a restore overwrites data. */
export function describeBackup(result: RestoreResult): string {
  const currency = CURRENCIES.find((c) => c.code === result.settings.homeCurrency);
  const parts = [
    `${result.subscriptions.length} subscription${result.subscriptions.length === 1 ? '' : 's'}`,
    currency ? `totals in ${currency.code}` : null,
    result.skipped.length > 0 ? `${result.skipped.length} unreadable entries skipped` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
