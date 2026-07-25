import type { FxTable } from '../engine/fx';

/**
 * FX is the one figure fetched at runtime, because it genuinely changes daily.
 * Everything else in this app is committed static JSON reviewed as a diff.
 *
 * Frankfurter: free, keyless, quota-free, sourced from central bank reference
 * rates. Those publish once per business day, so per-pageview fetching gains
 * nothing — cache for 12 hours and keep the last good response as a fallback.
 */

const ENDPOINT = 'https://api.frankfurter.dev/v1';
const CACHE_KEY = 'roundtrip.fx.v1';
const CACHE_MS = 12 * 60 * 60 * 1000;

export const SEED_SOURCE = 'Seed values from the build brief — not a live quote';

/**
 * Seed rates. These are the figures the golden tests are parameterised on:
 * A$1 = S$0.90 = US$0.71. They are a starting point, not a quote.
 */
export const SEED_FX: FxTable = {
  homeCurrency: 'AUD',
  perHome: { AUD: 1, SGD: 0.9, USD: 0.71 },
  asOf: '2026-07-23',
  source: SEED_SOURCE,
};

/**
 * The same seed, extended to every currency the selector offers, expressed
 * against USD so any of them can be the base.
 *
 * AUD and SGD are pinned to the brief's cross rates — 1/0.71 and 0.9/0.71 —
 * so `seedFor('AUD')` reproduces `SEED_FX` exactly and the golden tests keep
 * their anchor. The rest are order-of-magnitude figures whose only job is to
 * keep the page numerate when Frankfurter is unreachable. They are never
 * presented as a quote: the FX panel reads "not a live quote" until a real
 * response lands.
 */
const SEED_PER_USD: Record<string, number> = {
  USD: 1,
  AUD: 1 / 0.71,
  SGD: 0.9 / 0.71,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  CHF: 0.88,
  JPY: 157,
  HKD: 7.81,
  NZD: 1.64,
  INR: 86,
  CNY: 7.15,
  KRW: 1370,
  SEK: 10.6,
  NOK: 10.7,
  DKK: 6.87,
  PLN: 3.95,
  ILS: 3.7,
  BRL: 5.6,
  MXN: 18.5,
};

/**
 * A complete seed table based on any supported currency.
 *
 * This exists so a failed fetch degrades honestly. Returning the AUD seed to a
 * reader who picked GBP would label Australian dollars as pounds, which is
 * worse than any error message.
 */
export function seedFor(homeCurrency: string): FxTable {
  if (homeCurrency === SEED_FX.homeCurrency) return SEED_FX;

  const perUsdHome = SEED_PER_USD[homeCurrency];
  if (!perUsdHome) return SEED_FX;

  const perHome: Record<string, number> = {};
  for (const [code, perUsd] of Object.entries(SEED_PER_USD)) {
    perHome[code] = perUsd / perUsdHome;
  }
  perHome[homeCurrency] = 1;

  return { homeCurrency, perHome, asOf: SEED_FX.asOf, source: SEED_SOURCE };
}

interface Cached {
  table: FxTable;
  fetchedAt: number;
}

function readCache(homeCurrency: string): Cached | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}.${homeCurrency}`);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(homeCurrency: string, cached: Cached): void {
  try {
    localStorage.setItem(`${CACHE_KEY}.${homeCurrency}`, JSON.stringify(cached));
  } catch {
    // Private browsing, quota, whatever. The seed table still works.
  }
}

/**
 * Latest rates, cached. Falls back to the last good response, then to the seed
 * table. A third party going down must never take the calculator down.
 */
export async function fetchLatestFx(
  homeCurrency: string,
  symbols: string[],
): Promise<FxTable> {
  const cached = readCache(homeCurrency);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.table;

  const wanted = symbols.filter((s) => s !== homeCurrency);
  if (wanted.length === 0) return seedFor(homeCurrency);

  try {
    const url = `${ENDPOINT}/latest?base=${homeCurrency}&symbols=${wanted.join(',')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Frankfurter returned ${response.status}`);
    const body = (await response.json()) as { date: string; rates: Record<string, number> };

    const seed = seedFor(homeCurrency);
    const table: FxTable = {
      // Seed first, so a symbol the provider omits still has a usable rate
      // rather than throwing out of `rateToHome` mid-render.
      perHome: { ...seed.perHome, ...body.rates, [homeCurrency]: 1 },
      homeCurrency,
      asOf: body.date,
      source: 'Frankfurter, from ECB reference rates',
    };
    writeCache(homeCurrency, { table, fetchedAt: Date.now() });
    return table;
  } catch {
    return cached?.table ?? seedFor(homeCurrency);
  }
}

export interface FxHistory {
  currency: string;
  /** Units of the currency per one unit of home currency, monthly. */
  points: { date: string; rate: number }[];
  min: number;
  max: number;
  latest: number;
}

/**
 * Ten years of monthly rates. A saver betting three years of surplus on a
 * currency deserves to see where today's rate sits in its range, rather than
 * treating it as a permanent condition.
 */
export async function fetchFxHistory(
  homeCurrency: string,
  symbols: string[],
): Promise<Record<string, FxHistory>> {
  const wanted = symbols.filter((s) => s !== homeCurrency);
  if (wanted.length === 0) return {};

  const start = new Date();
  start.setFullYear(start.getFullYear() - 10);
  const from = start.toISOString().slice(0, 10);

  const url = `${ENDPOINT}/${from}..?base=${homeCurrency}&symbols=${wanted.join(',')}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Frankfurter returned ${response.status}`);
  const body = (await response.json()) as {
    rates: Record<string, Record<string, number>>;
  };

  const monthly = new Map<string, Record<string, number>>();
  for (const [date, rates] of Object.entries(body.rates)) {
    monthly.set(date.slice(0, 7), rates); // last observation of each month wins
  }

  const out: Record<string, FxHistory> = {};
  for (const currency of wanted) {
    const points = [...monthly.entries()]
      .map(([month, rates]) => ({ date: month, rate: rates[currency] }))
      .filter((point) => typeof point.rate === 'number')
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) continue;
    const values = points.map((p) => p.rate);
    out[currency] = {
      currency,
      points,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
    };
  }
  return out;
}
