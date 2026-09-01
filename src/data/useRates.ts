import { useEffect, useState } from 'react';

import { isRateTableStale } from '@/domain/fx';
import { fetchRateTable } from './rates';
import { useAppStore } from './store';

export type RateStatus = 'idle' | 'refreshing' | 'offline';

/**
 * Keeps exchange rates reasonably fresh.
 *
 * Refreshes on mount when the cached table is missing, stale, or in the wrong
 * base currency, and never blocks rendering: the app shows whatever it has and
 * quietly upgrades it. A failed refresh leaves the cache untouched and reports
 * 'offline' so the UI can say the figures are dated rather than pretending.
 *
 * Rates are published once a day, so anything under 12 hours old is not worth
 * a request.
 */
export function useRates(): RateStatus {
  const rates = useAppStore((state) => state.rates);
  const homeCurrency = useAppStore((state) => state.settings.homeCurrency);
  const hydrated = useAppStore((state) => state.hydrated);
  const setRates = useAppStore((state) => state.setRates);

  const [status, setStatus] = useState<RateStatus>('idle');

  const needsRefresh =
    rates === null || rates.base !== homeCurrency || isRateTableStale(rates, 12);

  useEffect(() => {
    // Waiting for hydration avoids firing a request against the default state
    // and then immediately discarding it when the stored table loads.
    if (!hydrated || !needsRefresh) {
      return;
    }

    let cancelled = false;
    setStatus('refreshing');

    fetchRateTable(homeCurrency).then((table) => {
      if (cancelled) return;
      if (table) {
        setRates(table);
        setStatus('idle');
      } else {
        setStatus('offline');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, needsRefresh, homeCurrency, setRates]);

  return status;
}
