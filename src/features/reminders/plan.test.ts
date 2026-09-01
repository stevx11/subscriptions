import { CYCLE_PRESETS } from '@/domain/cycle';
import { money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import {
  fireInstant,
  MAX_SCHEDULED,
  planReminders,
  planSignature,
  ReminderSettings,
} from './plan';

const TODAY = '2026-09-01';

const SETTINGS: ReminderSettings = {
  remindersEnabled: true,
  defaultReminderDays: 2,
  reminderHour: 9,
};

function make(overrides: Partial<Subscription> & { id: string }): Subscription {
  return {
    name: 'Netflix',
    brandId: 'netflix',
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

describe('planReminders', () => {
  it('plans nothing when reminders are off', () => {
    expect(planReminders([make({ id: 'a' })], { ...SETTINGS, remindersEnabled: false }, TODAY))
      .toEqual([]);
  });

  it('fires the default number of days before a charge', () => {
    const plans = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    const first = plans[0];
    expect(first.chargeOn).toBe('2026-09-15');
    expect(first.fireOn).toBe('2026-09-13');
    expect(first.title).toBe('Netflix renews in 2 days');
    expect(first.body).toBe('€13.99 will be charged.');
  });

  it('lets a subscription override the lead time', () => {
    const plans = planReminders(
      [make({ id: 'a', reminderDaysBefore: 7 })],
      SETTINGS,
      TODAY,
    );
    expect(plans[0].fireOn).toBe('2026-09-08');
    expect(plans[0].title).toBe('Netflix renews in 7 days');
  });

  it('supports a same-day reminder', () => {
    const plans = planReminders(
      [make({ id: 'a', reminderDaysBefore: 0 })],
      SETTINGS,
      TODAY,
    );
    expect(plans[0].fireOn).toBe('2026-09-15');
    expect(plans[0].title).toBe('Netflix renews today');
  });

  it('says "tomorrow" rather than "in 1 days"', () => {
    const plans = planReminders(
      [make({ id: 'a', reminderDaysBefore: 1 })],
      SETTINGS,
      TODAY,
    );
    expect(plans[0].title).toBe('Netflix renews tomorrow');
  });

  it('ignores paused and cancelled subscriptions', () => {
    const plans = planReminders(
      [make({ id: 'a', status: 'paused' }), make({ id: 'b', status: 'cancelled' })],
      SETTINGS,
      TODAY,
    );
    expect(plans).toEqual([]);
  });

  /**
   * A reminder whose fire date already passed must not be scheduled: iOS drops
   * it or fires it instantly, and either is worse than silence.
   */
  it('never plans a reminder in the past', () => {
    const plans = planReminders([make({ id: 'a', anchorDate: '2026-01-02' })], SETTINGS, TODAY);
    for (const plan of plans) {
      expect(plan.fireOn >= TODAY).toBe(true);
    }
  });

  it('plans several future charges for one subscription', () => {
    const plans = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    expect(plans.length).toBeGreaterThan(2);
    expect(new Set(plans.map((p) => p.chargeOn)).size).toBe(plans.length);
  });

  it('sorts by fire date across subscriptions', () => {
    const plans = planReminders(
      [
        make({ id: 'a', name: 'Later', anchorDate: '2026-01-25' }),
        make({ id: 'b', name: 'Sooner', anchorDate: '2026-01-05' }),
      ],
      SETTINGS,
      TODAY,
    );
    for (let i = 1; i < plans.length; i += 1) {
      expect(plans[i].fireOn >= plans[i - 1].fireOn).toBe(true);
    }
  });

  /**
   * iOS silently stops accepting local notifications past 64 pending, so the
   * plan has to truncate rather than trusting the platform to cope.
   */
  it('never exceeds the iOS pending-notification budget', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      make({ id: `s${i}`, cycle: CYCLE_PRESETS.weekly, anchorDate: '2026-08-30' }),
    );
    const plans = planReminders(many, SETTINGS, TODAY);
    expect(plans.length).toBeLessThanOrEqual(MAX_SCHEDULED);
  });

  it('keeps the nearest reminders when truncating', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      make({ id: `s${i}`, cycle: CYCLE_PRESETS.weekly, anchorDate: '2026-08-30' }),
    );
    const plans = planReminders(many, SETTINGS, TODAY);
    const furthest = plans[plans.length - 1].fireOn;
    // Everything kept should be close by, not scattered across the horizon.
    expect(furthest < '2026-10-15').toBe(true);
  });

  it('gives a converting trial its own wording', () => {
    const trial = make({
      id: 'a',
      name: 'Duolingo',
      status: 'trial',
      trialEndsAt: '2026-09-10',
      anchorDate: '2026-09-10',
      price: money(899, 'EUR'),
      reminderDaysBefore: 1,
    });
    const plans = planReminders([trial], SETTINGS, TODAY);
    const conversion = plans.find((p) => p.kind === 'trial');
    expect(conversion).toBeDefined();
    expect(conversion!.title).toBe('Duolingo trial ends tomorrow');
    expect(conversion!.body).toContain('unless you cancel');
    expect(conversion!.fireOn).toBe('2026-09-09');
  });

  it('treats charges after the trial converts as ordinary renewals', () => {
    const trial = make({
      id: 'a',
      status: 'trial',
      trialEndsAt: '2026-09-10',
      anchorDate: '2026-09-10',
    });
    const plans = planReminders([trial], SETTINGS, TODAY);
    expect(plans.filter((p) => p.kind === 'trial')).toHaveLength(1);
    expect(plans.filter((p) => p.kind === 'charge').length).toBeGreaterThan(0);
  });

  it('gives each plan a stable, unique key', () => {
    const plans = planReminders([make({ id: 'a' }), make({ id: 'b' })], SETTINGS, TODAY);
    const keys = plans.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    const again = planReminders([make({ id: 'a' }), make({ id: 'b' })], SETTINGS, TODAY);
    expect(again.map((p) => p.key)).toEqual(keys);
  });

  it('handles a yearly subscription without spamming', () => {
    const yearly = make({
      id: 'a',
      cycle: CYCLE_PRESETS.yearly,
      anchorDate: '2026-10-05',
      reminderDaysBefore: 7,
    });
    const plans = planReminders([yearly], SETTINGS, TODAY);
    expect(plans).toHaveLength(1);
    expect(plans[0].fireOn).toBe('2026-09-28');
  });
});

describe('planSignature', () => {
  it('is stable for identical plans', () => {
    const a = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    const b = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    expect(planSignature(a, 9)).toBe(planSignature(b, 9));
  });

  it('changes when the price changes, since the body text does', () => {
    const a = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    const b = planReminders([make({ id: 'a', price: money(1599, 'EUR') })], SETTINGS, TODAY);
    expect(planSignature(a, 9)).not.toBe(planSignature(b, 9));
  });

  it('changes when the hour changes', () => {
    const plans = planReminders([make({ id: 'a' })], SETTINGS, TODAY);
    expect(planSignature(plans, 9)).not.toBe(planSignature(plans, 18));
  });
});

describe('fireInstant', () => {
  const plan = {
    key: 'k',
    subscriptionId: 'a',
    kind: 'charge' as const,
    fireOn: '2026-09-13',
    chargeOn: '2026-09-15',
    title: 't',
    body: 'b',
  };

  it('builds a local-time instant at the configured hour', () => {
    const when = fireInstant(plan, 9, new Date(2026, 8, 1, 12, 0, 0));
    expect(when).not.toBeNull();
    expect(when!.getFullYear()).toBe(2026);
    expect(when!.getMonth()).toBe(8); // September
    expect(when!.getDate()).toBe(13);
    expect(when!.getHours()).toBe(9);
  });

  /**
   * Routine case: the app is opened in the evening and a same-day reminder's
   * hour has already gone. Scheduling it would fire instantly or be dropped.
   */
  it('returns null when the moment has already passed', () => {
    const evening = new Date(2026, 8, 13, 21, 0, 0);
    expect(fireInstant(plan, 9, evening)).toBeNull();
  });

  it('returns null exactly on the boundary', () => {
    const exactly = new Date(2026, 8, 13, 9, 0, 0, 0);
    expect(fireInstant(plan, 9, exactly)).toBeNull();
  });
});
