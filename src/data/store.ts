/**
 * The app's single source of truth, persisted to AsyncStorage.
 *
 * Zustand rather than a database: this is a personal app holding tens of
 * subscriptions, not thousands. Keeping the whole state in memory means reads
 * are synchronous (no loading spinners on a list of 20 rows), and the entire
 * state serialises to JSON — which is what makes the Phase 9 backup export a
 * few lines rather than a feature.
 *
 * Everything is stored in the subscription's *own* currency. Conversion to the
 * home currency happens at read time in `src/domain/totals.ts`, so changing the
 * home currency never rewrites stored data and can never corrupt it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CurrencyCode } from '@/domain/currency';
import { RateTable } from '@/domain/fx';
import { Subscription, SubscriptionStatus } from '@/domain/subscription';
import { todayIso } from '@/domain/date';
import { CURRENT_SCHEMA_VERSION, migrateState, PersistedShape } from './migrations';

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
  // Off until the user opts in: iOS only ever shows the permission prompt
  // once, so it must follow a deliberate action rather than app launch.
  remindersEnabled: false,
  reminderHour: 9,
};

/** What a caller supplies when creating a subscription; the rest is derived. */
export type NewSubscription = Omit<
  Subscription,
  'id' | 'createdAt' | 'updatedAt' | 'priceHistory'
> & { priceHistory?: Subscription['priceHistory'] };

interface AppState {
  subscriptions: Subscription[];
  settings: Settings;
  rates: RateTable | null;
  /** False until the persisted state has been read back from disk. */
  hydrated: boolean;

  addSubscription: (input: NewSubscription) => Subscription;
  updateSubscription: (id: string, changes: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  setStatus: (id: string, status: SubscriptionStatus) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  setRates: (rates: RateTable) => void;
  /** Wipes everything. Used by the Phase 9 restore flow and by dev tooling. */
  replaceAll: (subscriptions: Subscription[], settings?: Settings) => void;
}

function newId(): string {
  return Crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      settings: DEFAULT_SETTINGS,
      rates: null,
      hydrated: false,

      addSubscription: (input) => {
        const timestamp = nowIso();
        const subscription: Subscription = {
          ...input,
          id: newId(),
          createdAt: timestamp,
          updatedAt: timestamp,
          // Seed history with the opening price so a later change is detectable.
          priceHistory: input.priceHistory ?? [
            {
              since: input.anchorDate,
              amount: input.price.amount,
              currency: input.price.currency,
            },
          ],
        };
        set({ subscriptions: [...get().subscriptions, subscription] });
        return subscription;
      },

      updateSubscription: (id, changes) => {
        set({
          subscriptions: get().subscriptions.map((subscription) => {
            if (subscription.id !== id) {
              return subscription;
            }
            const updated: Subscription = {
              ...subscription,
              ...changes,
              id: subscription.id,
              createdAt: subscription.createdAt,
              updatedAt: nowIso(),
            };
            // A price change is worth recording — it is what powers the
            // "this went up 12% in January" insight later.
            const priceChanged =
              changes.price !== undefined &&
              (changes.price.amount !== subscription.price.amount ||
                changes.price.currency !== subscription.price.currency);
            if (priceChanged) {
              updated.priceHistory = [
                ...subscription.priceHistory,
                {
                  since: todayIso(),
                  amount: changes.price!.amount,
                  currency: changes.price!.currency,
                },
              ];
            }
            return updated;
          }),
        });
      },

      removeSubscription: (id) => {
        set({ subscriptions: get().subscriptions.filter((s) => s.id !== id) });
      },

      setStatus: (id, status) => {
        const changes: Partial<Subscription> = { status };
        if (status === 'cancelled') {
          changes.cancelledAt = todayIso();
        }
        get().updateSubscription(id, changes);
      },

      updateSettings: (changes) => {
        set({ settings: { ...get().settings, ...changes } });
      },

      setRates: (rates) => set({ rates }),

      replaceAll: (subscriptions, settings) => {
        set({
          subscriptions,
          settings: settings ?? get().settings,
        });
      },
    }),
    {
      name: 'subscriptions-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: CURRENT_SCHEMA_VERSION,
      // Actions are recreated on every launch; only data is worth persisting.
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        settings: state.settings,
        rates: state.rates,
      }),
      merge: (persisted, current) => {
        // Settings gain fields between releases. A shallow merge would leave
        // a newly added key undefined on an existing install, so defaults are
        // layered underneath whatever was stored.
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        };
      },
      migrate: (persisted, version) =>
        migrateState(persisted as PersistedShape, version) as never,
      onRehydrateStorage: () => (state) => {
        // Marks the app safe to render real data. Without this, the first
        // frame renders an empty list and then pops in the real one.
        useAppStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);

/** Selectors — kept here so components never re-implement filtering rules. */
export const selectActive = (state: AppState) =>
  state.subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');

export const selectById = (id: string) => (state: AppState) =>
  state.subscriptions.find((s) => s.id === id);
