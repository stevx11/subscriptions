import { CYCLE_PRESETS } from '@/domain/cycle';
import { money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import {
  changeCurrency,
  draftAmount,
  draftFromBrand,
  draftFromSubscription,
  emptyDraft,
  isDraftValid,
  popDigit,
  pushDigit,
  toNewSubscription,
  validateDraft,
} from './draft';

const TODAY = '2026-09-01';
const NETFLIX = { id: 'netflix', title: 'Netflix', hex: '#E50914', category: 'Video' };

describe('pushDigit', () => {
  it('fills minor units from the right', () => {
    let digits = '';
    for (const key of ['1', '3', '9', '9']) {
      digits = pushDigit(digits, key);
    }
    expect(digits).toBe('1399');
    expect(draftAmount({ ...emptyDraft('EUR', TODAY), amountDigits: digits }).amount).toBe(
      1399,
    );
  });

  it('strips leading zeros so 0 then 5 is 5, not 05', () => {
    expect(pushDigit(pushDigit('', '0'), '5')).toBe('5');
  });

  it('keeps a lone zero', () => {
    expect(pushDigit('', '0')).toBe('0');
  });

  it('supports a double-zero key', () => {
    expect(pushDigit('13', '00')).toBe('1300');
  });

  it('refuses input beyond a plausible length', () => {
    expect(pushDigit('123456789', '9')).toBe('123456789');
  });
});

describe('popDigit', () => {
  it('removes the last digit and tolerates an empty string', () => {
    expect(popDigit('1399')).toBe('139');
    expect(popDigit('')).toBe('');
  });
});

describe('changeCurrency', () => {
  it('keeps digits when precision matches', () => {
    const draft = { ...emptyDraft('EUR', TODAY), amountDigits: '1399' };
    expect(changeCurrency(draft, 'USD').amountDigits).toBe('1399');
  });

  /**
   * The number on screen must not change meaning when the currency does:
   * 13.99 EUR becomes 14 JPY, not 1399 JPY.
   */
  it('rescales into a zero-decimal currency', () => {
    const draft = { ...emptyDraft('EUR', TODAY), amountDigits: '1399' };
    const next = changeCurrency(draft, 'JPY');
    expect(next.amountDigits).toBe('14');
    expect(draftAmount(next).amount).toBe(14);
  });

  it('rescales back out of a zero-decimal currency', () => {
    const draft = { ...emptyDraft('JPY', TODAY), amountDigits: '14' };
    expect(changeCurrency(draft, 'EUR').amountDigits).toBe('1400');
  });

  it('leaves an empty amount empty', () => {
    expect(changeCurrency(emptyDraft('EUR', TODAY), 'JPY').amountDigits).toBe('');
  });

  it('clears rather than showing a bogus zero when rounding wipes the value', () => {
    const draft = { ...emptyDraft('EUR', TODAY), amountDigits: '3' }; // 0.03
    expect(changeCurrency(draft, 'JPY').amountDigits).toBe('');
  });
});

describe('draftFromBrand', () => {
  it('prefills everything the brand knows, leaving only the amount', () => {
    const draft = draftFromBrand(NETFLIX, 'EUR', TODAY);
    expect(draft.name).toBe('Netflix');
    expect(draft.brandId).toBe('netflix');
    expect(draft.color).toBe('#E50914');
    expect(draft.category).toBe('Video');
    expect(draft.cycle).toEqual(CYCLE_PRESETS.monthly);
    expect(draft.amountDigits).toBe('');
  });
});

describe('validateDraft', () => {
  const valid = { ...draftFromBrand(NETFLIX, 'EUR', TODAY), amountDigits: '1399' };

  it('accepts a complete draft', () => {
    expect(validateDraft(valid, TODAY)).toEqual({});
    expect(isDraftValid(valid, TODAY)).toBe(true);
  });

  it('requires a name', () => {
    expect(validateDraft({ ...valid, name: '   ' }, TODAY).name).toBeTruthy();
  });

  it('requires a non-zero amount', () => {
    expect(validateDraft({ ...valid, amountDigits: '' }, TODAY).amount).toBeTruthy();
    expect(validateDraft({ ...valid, amountDigits: '0' }, TODAY).amount).toBeTruthy();
  });

  it('allows a past start date for a normal subscription', () => {
    // You routinely add something you have already been paying for.
    expect(validateDraft({ ...valid, anchorDate: '2024-01-01' }, TODAY)).toEqual({});
  });

  it('rejects a trial that already ended', () => {
    const draft = { ...valid, isTrial: true, anchorDate: '2026-08-01' };
    expect(validateDraft(draft, TODAY).anchorDate).toBeTruthy();
  });
});

describe('toNewSubscription', () => {
  const base = { ...draftFromBrand(NETFLIX, 'EUR', TODAY), amountDigits: '1399' };

  it('produces an active subscription', () => {
    const result = toNewSubscription(base);
    expect(result.status).toBe('active');
    expect(result.price).toEqual(money(1399, 'EUR'));
    expect(result.trialEndsAt).toBeUndefined();
  });

  it('trims the name', () => {
    expect(toNewSubscription({ ...base, name: '  Netflix  ' }).name).toBe('Netflix');
  });

  it('maps a trial so the first charge lands when the trial converts', () => {
    const result = toNewSubscription({ ...base, isTrial: true, anchorDate: '2026-09-15' });
    expect(result.status).toBe('trial');
    expect(result.trialEndsAt).toBe('2026-09-15');
    expect(result.anchorDate).toBe('2026-09-15');
  });

  it('drops empty optional text rather than storing blanks', () => {
    const result = toNewSubscription({ ...base, notes: '   ', cancelUrl: '' });
    expect(result.notes).toBeUndefined();
    expect(result.cancelUrl).toBeUndefined();
  });
});

describe('draftFromSubscription', () => {
  const subscription: Subscription = {
    id: 'x',
    name: 'Netflix',
    brandId: 'netflix',
    color: '#E50914',
    category: 'Video',
    price: money(1399, 'EUR'),
    cycle: CYCLE_PRESETS.monthly,
    anchorDate: '2026-01-15',
    status: 'active',
    reminderDaysBefore: 3,
    priceHistory: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  };

  it('round-trips through the form without losing anything', () => {
    const back = toNewSubscription(draftFromSubscription(subscription));
    expect(back.name).toBe(subscription.name);
    expect(back.price).toEqual(subscription.price);
    expect(back.cycle).toEqual(subscription.cycle);
    expect(back.anchorDate).toBe(subscription.anchorDate);
    expect(back.brandId).toBe(subscription.brandId);
    expect(back.reminderDaysBefore).toBe(3);
  });

  it('recognises an existing trial', () => {
    const draft = draftFromSubscription({
      ...subscription,
      status: 'trial',
      trialEndsAt: '2026-09-20',
    });
    expect(draft.isTrial).toBe(true);
  });
});
