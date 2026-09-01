/**
 * App settings.
 *
 * Deliberately its own module rather than living in `store.ts`: the store
 * imports AsyncStorage and expo-crypto, which cannot run under Jest on
 * Windows. Anything that needs the shape of settings — backup parsing, the
 * reminder planner — imports from here instead, and stays testable.
 */

import { CurrencyCode } from '@/domain/currency';

export interface Settings {
  homeCurrency: CurrencyCode;
  /** Default days before a charge to remind, when a subscription has no override. */
  defaultReminderDays: number;
  /** Whether reminders are scheduled at all. */
  remindersEnabled: boolean;
  /** Local hour of day reminders fire, 0-23. */
  reminderHour: number;
}

export const DEFAULT_SETTINGS: Settings = {
  homeCurrency: 'EUR',
  defaultReminderDays: 2,
  // Off until the user opts in: iOS shows the notification permission prompt
  // exactly once per install, so it must follow a deliberate action rather
  // than app launch.
  remindersEnabled: false,
  reminderHour: 9,
};
