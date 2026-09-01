import { CYCLE_PRESETS } from '@/domain/cycle';
import { money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import { DEFAULT_SETTINGS } from '@/data/settings';
import {
  backupFileName,
  BackupError,
  describeBackup,
  exportBackup,
  parseBackup,
} from './backup';

function make(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    name: 'Netflix',
    brandId: 'netflix',
    color: '#E50914',
    category: 'Video',
    price: money(1399, 'EUR'),
    cycle: CYCLE_PRESETS.monthly,
    anchorDate: '2026-01-15',
    status: 'active',
    reminderDaysBefore: 3,
    notes: 'family plan',
    priceHistory: [{ since: '2026-01-15', amount: 1399, currency: 'EUR' }],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportBackup', () => {
  it('produces parseable JSON with a format marker', () => {
    const json = exportBackup([make()], DEFAULT_SETTINGS);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('subscriptions-backup');
    expect(parsed.version).toBe(1);
    expect(parsed.subscriptions).toHaveLength(1);
  });

  it('records when it was taken', () => {
    const json = exportBackup([], DEFAULT_SETTINGS, new Date('2026-09-15T10:00:00.000Z'));
    expect(JSON.parse(json).exportedAt).toBe('2026-09-15T10:00:00.000Z');
  });
});

describe('backupFileName', () => {
  it('is dated so several backups do not collide', () => {
    expect(backupFileName(new Date('2026-09-15T10:00:00.000Z'))).toBe(
      'subscriptions-2026-09-15.json',
    );
  });
});

describe('parseBackup round-trip', () => {
  it('restores everything it exported', () => {
    const original = make();
    const restored = parseBackup(exportBackup([original], DEFAULT_SETTINGS));

    expect(restored.subscriptions).toHaveLength(1);
    expect(restored.subscriptions[0]).toEqual(original);
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
    expect(restored.skipped).toEqual([]);
  });

  it('survives a subscription with every optional field set', () => {
    const full = make({
      status: 'trial',
      trialEndsAt: '2026-10-01',
      cancelledAt: '2026-11-01',
      usageRating: 1,
      cancelUrl: 'https://example.com/cancel',
      priceHistory: [
        { since: '2025-01-15', amount: 1099, currency: 'EUR' },
        { since: '2026-01-15', amount: 1399, currency: 'EUR' },
      ],
    });
    const restored = parseBackup(exportBackup([full], DEFAULT_SETTINGS));
    expect(restored.subscriptions[0]).toEqual(full);
  });

  it('preserves custom settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      homeCurrency: 'USD' as const,
      reminderHour: 18,
      remindersEnabled: true,
    };
    const restored = parseBackup(exportBackup([make()], settings));
    expect(restored.settings).toEqual(settings);
  });
});

describe('parseBackup rejection', () => {
  it.each([
    ['not JSON at all', 'hello'],
    ['an empty string', ''],
    ['a JSON array', '[]'],
    ['JSON without the format marker', '{"subscriptions":[]}'],
    ['a different app’s file', '{"format":"something-else","version":1,"subscriptions":[]}'],
  ])('refuses %s', (_label, contents) => {
    expect(() => parseBackup(contents)).toThrow(BackupError);
  });

  /**
   * Importing a backup from a future version could silently drop fields it does
   * not understand, so it is refused rather than partially applied.
   */
  it('refuses a backup from a newer app version', () => {
    const json = JSON.stringify({
      format: 'subscriptions-backup',
      version: 99,
      subscriptions: [make()],
    });
    expect(() => parseBackup(json)).toThrow(/newer version/);
  });

  it('refuses a backup with nothing usable in it', () => {
    const json = JSON.stringify({
      format: 'subscriptions-backup',
      version: 1,
      subscriptions: [{ nonsense: true }],
    });
    expect(() => parseBackup(json)).toThrow(/No usable subscriptions/);
  });
});

describe('parseBackup resilience', () => {
  const wrap = (subscriptions: unknown[]) =>
    JSON.stringify({ format: 'subscriptions-backup', version: 1, subscriptions });

  it('keeps good entries and reports bad ones', () => {
    const json = wrap([make(), { name: 'Broken' }, make({ id: 'two', name: 'Spotify' })]);
    const restored = parseBackup(json);
    expect(restored.subscriptions.map((s) => s.name)).toEqual(['Netflix', 'Spotify']);
    expect(restored.skipped).toHaveLength(1);
    expect(restored.skipped[0]).toContain('Broken');
  });

  it('rejects an entry whose amount is not an integer', () => {
    const json = wrap([make(), { ...make({ id: 'x', name: 'Floaty' }), price: { amount: 13.99, currency: 'EUR' } }]);
    const restored = parseBackup(json);
    expect(restored.subscriptions).toHaveLength(1);
    expect(restored.skipped[0]).toContain('Floaty');
  });

  it('rejects an entry with an unknown currency', () => {
    const json = wrap([make(), { ...make({ id: 'x', name: 'Zorkmid' }), price: { amount: 100, currency: 'ZZZ' } }]);
    const restored = parseBackup(json);
    expect(restored.skipped[0]).toContain('Zorkmid');
  });

  it('rejects an entry with a malformed date', () => {
    const json = wrap([make(), { ...make({ id: 'x', name: 'Undated' }), anchorDate: '15/01/2026' }]);
    const restored = parseBackup(json);
    expect(restored.skipped[0]).toContain('Undated');
  });

  it('rejects an entry with a zero-interval cycle', () => {
    const json = wrap([
      make(),
      { ...make({ id: 'x', name: 'Cycleless' }), cycle: { unit: 'month', interval: 0 } },
    ]);
    const restored = parseBackup(json);
    expect(restored.skipped[0]).toContain('Cycleless');
  });

  it('falls back to defaults for a missing settings block', () => {
    const restored = parseBackup(wrap([make()]));
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('drops unreadable price-history points but keeps the subscription', () => {
    const json = wrap([
      {
        ...make(),
        priceHistory: [
          { since: '2026-01-15', amount: 1399, currency: 'EUR' },
          { since: 'whenever', amount: 1, currency: 'EUR' },
        ],
      },
    ]);
    const restored = parseBackup(json);
    expect(restored.subscriptions).toHaveLength(1);
    expect(restored.subscriptions[0].priceHistory).toHaveLength(1);
  });

  it('gives a restored entry an id even if the file had none', () => {
    const { id, ...withoutId } = make();
    void id;
    const restored = parseBackup(wrap([withoutId]));
    expect(restored.subscriptions[0].id).toBeTruthy();
  });
});

describe('describeBackup', () => {
  it('summarises what will be restored', () => {
    const restored = parseBackup(exportBackup([make()], DEFAULT_SETTINGS));
    expect(describeBackup(restored)).toContain('1 subscription');
    expect(describeBackup(restored)).toContain('EUR');
  });

  it('mentions skipped entries', () => {
    const json = JSON.stringify({
      format: 'subscriptions-backup',
      version: 1,
      subscriptions: [make(), { broken: true }],
    });
    expect(describeBackup(parseBackup(json))).toContain('skipped');
  });
});
