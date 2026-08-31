/**
 * The add/edit form's state, kept as pure data.
 *
 * Deliberately separate from the React components so the rules that decide
 * whether a subscription is valid — and how a half-filled form becomes a real
 * `Subscription` — can be tested on Windows. Form validation is exactly the
 * kind of logic that quietly rots when it lives inside a component.
 *
 * The amount is held as a *digit string* rather than a number. The keypad
 * appends digits and they fill the minor units from the right, so typing
 * 1-3-9-9 gives €13.99 with no decimal key and no cursor to place. It also
 * sidesteps parsing entirely: there is no such thing as half-typed invalid
 * input, only fewer digits.
 */

import { BillingCycle, CYCLE_PRESETS } from '@/domain/cycle';
import { CurrencyCode, getCurrency } from '@/domain/currency';
import { addDays, compareIsoDate, IsoDate, todayIso } from '@/domain/date';
import { Money } from '@/domain/money';
import { Subscription } from '@/domain/subscription';
import type { NewSubscription } from '@/data/store';

export interface Draft {
  brandId?: string;
  name: string;
  color: string;
  category: string;
  /** Digits as typed. "1399" means 13.99 in a 2-decimal currency. */
  amountDigits: string;
  currency: CurrencyCode;
  cycle: BillingCycle;
  /** First billing date, or the date the trial converts. */
  anchorDate: IsoDate;
  isTrial: boolean;
  /** Days before a charge to remind. null means "use the global default". */
  reminderDaysBefore: number | null;
  notes: string;
  cancelUrl: string;
}

/** Longer than this and the number stops being plausible as a subscription. */
const MAX_DIGITS = 9;

export function emptyDraft(currency: CurrencyCode, today: IsoDate = todayIso()): Draft {
  return {
    name: '',
    color: '#5B8DEF',
    category: 'Other',
    amountDigits: '',
    currency,
    cycle: CYCLE_PRESETS.monthly,
    anchorDate: today,
    isTrial: false,
    reminderDaysBefore: null,
    notes: '',
    cancelUrl: '',
  };
}

export function draftFromBrand(
  brand: { id: string; title: string; hex: string; category: string },
  currency: CurrencyCode,
  today: IsoDate = todayIso(),
): Draft {
  return {
    ...emptyDraft(currency, today),
    brandId: brand.id,
    name: brand.title,
    color: brand.hex,
    category: brand.category,
  };
}

/** Reverse of `toNewSubscription`, for opening the form on an existing record. */
export function draftFromSubscription(subscription: Subscription): Draft {
  return {
    brandId: subscription.brandId,
    name: subscription.name,
    color: subscription.color,
    category: subscription.category,
    amountDigits: String(Math.abs(subscription.price.amount)),
    currency: subscription.price.currency,
    cycle: subscription.cycle,
    anchorDate: subscription.anchorDate,
    isTrial: subscription.status === 'trial',
    reminderDaysBefore: subscription.reminderDaysBefore,
    notes: subscription.notes ?? '',
    cancelUrl: subscription.cancelUrl ?? '',
  };
}

/** Append a keypad digit, ignoring leading zeros and over-long input. */
export function pushDigit(digits: string, key: string): string {
  const next = digits + key;
  const trimmed = next.replace(/^0+(?=\d)/, '');
  return trimmed.length > MAX_DIGITS ? digits : trimmed;
}

export function popDigit(digits: string): string {
  return digits.slice(0, -1);
}

export function draftAmount(draft: Draft): Money {
  return {
    amount: draft.amountDigits === '' ? 0 : Number(draft.amountDigits),
    currency: draft.currency,
  };
}

/**
 * Switching currency must not silently change the amount's meaning.
 *
 * Digits fill minor units, so "1399" is 13.99 in EUR but ¥1399 in JPY. Moving
 * between a 2-decimal and a 0-decimal currency therefore rescales the digits,
 * so the number the user sees stays the number they typed.
 */
export function changeCurrency(draft: Draft, next: CurrencyCode): Draft {
  const fromDecimals = getCurrency(draft.currency).decimals;
  const toDecimals = getCurrency(next).decimals;
  if (draft.amountDigits === '' || fromDecimals === toDecimals) {
    return { ...draft, currency: next };
  }

  const current = Number(draft.amountDigits);
  const rescaled =
    toDecimals > fromDecimals
      ? current * 10 ** (toDecimals - fromDecimals)
      : Math.round(current / 10 ** (fromDecimals - toDecimals));

  return {
    ...draft,
    currency: next,
    amountDigits: rescaled === 0 ? '' : String(rescaled).slice(0, MAX_DIGITS),
  };
}

export type DraftField = 'name' | 'amount' | 'anchorDate';

/**
 * Validation is only ever reported for fields the user has actually reached.
 * A red "required" on an untouched field is nagging, not helping — so this
 * returns every problem and the UI decides which are worth surfacing yet.
 */
export function validateDraft(
  draft: Draft,
  today: IsoDate = todayIso(),
): Partial<Record<DraftField, string>> {
  const errors: Partial<Record<DraftField, string>> = {};

  if (draft.name.trim() === '') {
    errors.name = 'Give it a name';
  }

  const amount = draftAmount(draft);
  if (amount.amount <= 0) {
    errors.amount = 'Enter how much it costs';
  }

  if (draft.isTrial && compareIsoDate(draft.anchorDate, today) < 0) {
    errors.anchorDate = 'A trial cannot end in the past';
  }

  return errors;
}

export function isDraftValid(draft: Draft, today: IsoDate = todayIso()): boolean {
  return Object.keys(validateDraft(draft, today)).length === 0;
}

export function toNewSubscription(draft: Draft): NewSubscription {
  const trimmedNotes = draft.notes.trim();
  const trimmedUrl = draft.cancelUrl.trim();

  return {
    name: draft.name.trim(),
    brandId: draft.brandId,
    color: draft.color,
    category: draft.category,
    price: draftAmount(draft),
    cycle: draft.cycle,
    anchorDate: draft.anchorDate,
    status: draft.isTrial ? 'trial' : 'active',
    // For a trial the anchor *is* the conversion date: the first charge lands
    // the day the trial ends, and every later one cycles from there.
    trialEndsAt: draft.isTrial ? draft.anchorDate : undefined,
    reminderDaysBefore: draft.reminderDaysBefore,
    notes: trimmedNotes === '' ? undefined : trimmedNotes,
    cancelUrl: trimmedUrl === '' ? undefined : trimmedUrl,
  };
}

/** Quick-pick options offered next to the date field. */
export function dateShortcuts(today: IsoDate = todayIso()) {
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'In a week', date: addDays(today, 7) },
    { label: 'In a month', date: addDays(today, 30) },
  ];
}
