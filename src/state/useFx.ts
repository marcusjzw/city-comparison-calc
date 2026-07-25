import { useEffect, useState } from 'react';
import type { FxTable } from '../engine/fx';
import { fetchFxHistory, fetchLatestFx, SEED_FX, type FxHistory } from '../data/fx';

/**
 * Rates come from Frankfurter at runtime, cached for 12 hours, with the seed
 * table as the fallback. The app renders immediately on the seed values and
 * swaps them in when the quote lands — a third party being slow or down must
 * never stop the calculator working.
 */
export function useFx(homeCurrency: string, currencies: string[]) {
  const [table, setTable] = useState<FxTable>(SEED_FX);
  const [history, setHistory] = useState<Record<string, FxHistory>>({});
  const [live, setLive] = useState(false);

  const key = currencies.join(',');

  useEffect(() => {
    let cancelled = false;
    const symbols = key.split(',').filter(Boolean);

    fetchLatestFx(homeCurrency, symbols).then((next) => {
      if (cancelled) return;
      setTable(next);
      setLive(next.source !== SEED_FX.source);
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

  return { table, history, live };
}
