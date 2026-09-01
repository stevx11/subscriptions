/**
 * Exchange rates.
 *
 * Source is open.er-api.com: free, no API key, no account, ~166 currencies —
 * which matters because the ECB feeds most "free" endpoints use omit RSD and
 * BAM, both of which are in our currency list.
 *
 * The parsing is a pure function so it can be tested without a network, and it
 * is deliberately paranoid: a malformed or partial response must be rejected
 * whole rather than half-applied, because a rate table with a few plausible
 * wrong numbers in it silently corrupts every total in the app.
 *
 * Failure is never fatal. A stale rate is far better than a blank headline
 * figure, so the cached table stays in place and the UI shows how old it is.
 */

import { CurrencyCode, isCurrencyCode } from '@/domain/currency';
import { RateTable } from '@/domain/fx';

const ENDPOINT = 'https://open.er-api.com/v6/latest/';
const TIMEOUT_MS = 10_000;

/**
 * Validate and narrow an API response into a RateTable.
 * Returns null for anything unexpected rather than guessing.
 */
export function parseRateResponse(payload: unknown, expectedBase: CurrencyCode): RateTable | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const body = payload as Record<string, unknown>;

  if (body.result !== 'success') {
    return null;
  }
  if (body.base_code !== expectedBase) {
    return null;
  }
  if (typeof body.rates !== 'object' || body.rates === null) {
    return null;
  }

  const source = body.rates as Record<string, unknown>;
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(source)) {
    // Keep only currencies we can actually display, and only sane numbers.
    if (!isCurrencyCode(code)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    rates[code] = value;
  }

  // A response that yielded nothing usable is a failure, not an empty success.
  if (Object.keys(rates).length === 0) {
    return null;
  }

  // Prefer the upstream timestamp so staleness reflects when the rates were
  // actually published, not when we happened to download them.
  const published =
    typeof body.time_last_update_unix === 'number'
      ? new Date(body.time_last_update_unix * 1000).toISOString()
      : new Date().toISOString();

  return { base: expectedBase, rates, fetchedAt: published };
}

/**
 * Fetch a fresh rate table. Resolves to null on any failure — network down,
 * timeout, bad payload — so callers can simply keep whatever they had.
 */
export async function fetchRateTable(base: CurrencyCode): Promise<RateTable | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}${base}`, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return parseRateResponse(await response.json(), base);
  } catch {
    // Offline, aborted, or unparseable. The cached table stands.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
