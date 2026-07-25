import { useEffect, useState } from 'react';
import type { FxTable } from '../engine/fx';
import {
  fetchFxHistory,
  fetchLatestFx,
  seedFor,
  SEED_SOURCE,
  type FxHistory,
} from '../data/fx';

/**
 * Rates come from Frankfurter at runtime, cached for 12 hours, with the seed
 * table as the fallback. The app renders immediately on the seed values and
 * swaps them in when the quote lands — a third party being slow or down must
 * never stop the calculator working.
 *
 * When the reader changes currency, the previous table is dropped in the same
 * render rather than on the next one. Holding it for even a frame would print
 * Australian dollars under a pound sign, and a wrong number shown confidently
 * is the one failure this app cannot afford.
 */
export function useFx(homeCurrency: string, currencies: string[]) {
  const [fetched, setFetched] = useState<FxTable | null>(null);
  const [history, setHistory] = useState<Record<string, FxHistory>>({});

  const key = currencies.join(',');

  useEffect(() => {
    let cancelled = false;
    const symbols = key.split(',').filter(Boolean);

    fetchLatestFx(homeCurrency, symbols).then((next) => {
      if (!cancelled) setFetched(next);
    });

    fetchFxHistory(homeCurrency, symbols)
      .then((next) => !cancelled && setHistory(next))
      .catch(() => {
        // History is decoration on the FX panel, not load-bearing. Skip it.
      });

    return () => {
      cancelled = true;
    };
  }, [homeCurrency, key]);

  // Trust the fetched table only while it still describes the currency being
  // asked about. Anything else falls back to that currency's seed.
  const stale = !fetched || fetched.homeCurrency !== homeCurrency;
  const table = stale ? seedFor(homeCurrency) : fetched;

  return {
    table,
    // History is keyed to the base currency too, so it goes with the table.
    history: stale ? {} : history,
    live: table.source !== SEED_SOURCE,
  };
}
