/**
 * Realistic sample subscriptions for evaluating the design.
 *
 * A design judged against three identical test rows tells you nothing. This
 * set is deliberately awkward in the ways real data is awkward: mixed
 * currencies, mixed billing cycles, a very dark brand colour next to a very
 * bright one, a long name that must truncate, a free trial about to convert,
 * a paused subscription, and renewal dates spread across the next few weeks.
 *
 * Removed once the app has real data in it.
 */

import { CYCLE_PRESETS } from '@/domain/cycle';
import { addDays, todayIso } from '@/domain/date';
import { money } from '@/domain/money';
import type { NewSubscription } from './store';

export function sampleSubscriptions(): NewSubscription[] {
  const today = todayIso();

  // Anchors are placed in the past so "next billing" lands at a spread of
  // future dates, which is what the dashboard actually sorts on.
  const back = (days: number) => addDays(today, -days);

  return [
    {
      name: 'Netflix',
      brandId: 'netflix',
      color: '#E50914',
      category: 'Video',
      price: money(1399, 'EUR'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(28),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'Spotify',
      brandId: 'spotify',
      color: '#1DB954',
      category: 'Music',
      price: money(1099, 'EUR'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(25),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'ChatGPT',
      brandId: 'openai',
      color: '#10A37F',
      category: 'AI',
      price: money(2000, 'USD'), // different currency on purpose
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(23),
      status: 'active',
      reminderDaysBefore: 3,
    },
    {
      name: 'Prime Video',
      brandId: 'primevideo',
      color: '#00A8E1',
      category: 'Video',
      price: money(499, 'EUR'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(20),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'Adobe Creative Cloud',
      brandId: 'adobecreativecloud',
      color: '#DA1F26',
      category: 'Software',
      price: money(6099, 'EUR'), // long name + big number, worst case for layout
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(12),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'JetBrains',
      brandId: 'jetbrains',
      color: '#000000',
      category: 'Software',
      price: money(28900, 'EUR'),
      cycle: CYCLE_PRESETS.yearly, // normalisation is visible here
      anchorDate: back(300),
      status: 'active',
      reminderDaysBefore: 7,
    },
    {
      name: 'iCloud+',
      brandId: 'icloud',
      color: '#3693F3',
      category: 'Cloud',
      price: money(299, 'EUR'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(4),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'Xbox Game Pass',
      brandId: 'xbox',
      color: '#107C10',
      category: 'Gaming',
      price: money(1299, 'EUR'),
      cycle: CYCLE_PRESETS.quarterly,
      anchorDate: back(60),
      status: 'active',
      reminderDaysBefore: null,
    },
    {
      name: 'Duolingo',
      brandId: 'duolingo',
      color: '#58CC02', // very bright, next to very dark ones
      category: 'Education',
      price: money(899, 'EUR'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(17),
      status: 'trial',
      trialEndsAt: addDays(today, 2), // converting imminently
      reminderDaysBefore: 1,
    },
    {
      name: 'Figma',
      brandId: 'figma',
      color: '#F24E1E',
      category: 'Software',
      price: money(1200, 'USD'),
      cycle: CYCLE_PRESETS.monthly,
      anchorDate: back(9),
      status: 'paused', // must not count toward totals
      reminderDaysBefore: null,
    },
  ];
}
