import { useCallback, useEffect, useRef, useState } from 'react';
import { CITIES } from '../data/cities';
import { FALLBACK_CURRENCY, isSupportedCurrency } from '../data/currencies';
import type { Scenario } from '../engine/scenario';
import { detectCurrencyFromEnvironment } from '../lib/detectCurrency';

/**
 * The cities compared out of the box. Named explicitly rather than "all of
 * `CITIES`" — a city added to the data set later should be something a
 * reader opts into from the selector, not something that silently appears
 * in everyone's comparison.
 */
const DEFAULT_CITY_IDS = ['sydney', 'singapore', 'san-francisco'];

/** The user in the brief: a Sydney senior on A$311,500 all-in with a deposit in mind. */
export const DEFAULT_SCENARIO: Scenario = {
  homeCityId: 'sydney',
  displayCurrency: FALLBACK_CURRENCY,
  current: { comp: 311_500 },
  homeSpendOverride: null,
  filingStatus: 'married_joint',
  preTaxDeductions: 0,
  goal: {
    target: 400_000,
    goalGrowthRate: 0.05,
    years: 4,
  },
  mode: 'goal',
  countRetirement: false,
  basketOverrides: {},
  healthOverrides: {},
  fxShifts: {},
  selectedCityIds: DEFAULT_CITY_IDS,
};

const STORAGE_KEY = 'roundtrip.scenario.v1';

/**
 * The full scenario lives in the URL hash, so a link reproduces an exact
 * comparison. That is the entire sharing feature and it costs almost nothing.
 */
function encode(scenario: Scenario): string {
  return btoa(encodeURIComponent(JSON.stringify(scenario)));
}

/**
 * An explicit choice always wins; detection only fills a genuine blank.
 *
 * A link shared from before the selector existed, or one carrying a currency
 * we can no longer quote, has no usable answer in it — so we work one out
 * rather than silently assuming dollars.
 */
function resolveCurrency(stored: unknown): string {
  if (typeof stored === 'string' && isSupportedCurrency(stored)) return stored;
  return detectCurrencyFromEnvironment().currency;
}

/**
 * Links minted before comp was a single figure carry `{ base, equity }`, and
 * links minted before savings was dropped as an input carry a now-unused
 * `annualSavings`. Both are out in the world already: the comp half gets
 * folded into the one number rather than silently falling back to the
 * default salary, and the savings half is simply ignored.
 */
type LegacyComp = Partial<Scenario['current']> & {
  base?: number;
  equity?: number;
  annualSavings?: number;
};

export function resolveComp(stored: unknown): Scenario['current'] {
  if (!stored || typeof stored !== 'object') return DEFAULT_SCENARIO.current;
  const legacy = stored as LegacyComp;
  if (typeof legacy.comp === 'number') return { comp: legacy.comp };
  if (typeof legacy.base === 'number' || typeof legacy.equity === 'number') {
    return { comp: (legacy.base ?? 0) + (legacy.equity ?? 0) };
  }
  return DEFAULT_SCENARIO.current;
}

/**
 * A link may name a city that has since been renamed or dropped, or predate
 * the selector entirely. Either way, drop what no longer resolves rather
 * than crash on it, and fall back to the smart default instead of an empty
 * comparison.
 */
function resolveSelectedCityIds(stored: unknown): string[] {
  const known = new Set(CITIES.map((c) => c.id));
  const ids = Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  return ids.length > 0 ? ids : DEFAULT_CITY_IDS;
}

function decode(raw: string): Scenario | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(raw))) as Partial<Scenario>;
    if (!parsed || typeof parsed !== 'object' || !parsed.homeCityId) return null;
    // Merge over the defaults so an older link missing a newer field still opens.
    return {
      ...DEFAULT_SCENARIO,
      ...parsed,
      current: resolveComp(parsed.current),
      goal: { ...DEFAULT_SCENARIO.goal, ...parsed.goal },
      displayCurrency: resolveCurrency(parsed.displayCurrency),
      selectedCityIds: resolveSelectedCityIds(parsed.selectedCityIds),
    };
  } catch {
    return null;
  }
}

/** The starting scenario for someone who has never been here before. */
function freshScenario(): Scenario {
  return { ...DEFAULT_SCENARIO, displayCurrency: resolveCurrency(null) };
}

function initial(): Scenario {
  const fromHash = window.location.hash.startsWith('#s=')
    ? decode(window.location.hash.slice(3))
    : null;
  if (fromHash) return fromHash;
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved && decode(saved)) || freshScenario();
}

export function useScenario() {
  const [scenario, setScenario] = useState<Scenario>(initial);
  const syncTimer = useRef<number | null>(null);

  useEffect(() => {
    /* A slider drag fires dozens of scenario updates a second. Writing the
       URL on every one of those hits Safari's replaceState rate limit
       ("attempt to use history.replaceState() more than 100 times per 10
       seconds"), which throws. Debounce the sync so it settles once the
       drag pauses, instead of on every tick. */
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      const encoded = encode(scenario);
      try {
        localStorage.setItem(STORAGE_KEY, encoded);
      } catch {
        // Private browsing. The session still works, it just will not persist.
      }
      window.history.replaceState(null, '', `#s=${encoded}`);
    }, 200);
    return () => {
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    };
  }, [scenario]);

  const update = useCallback((patch: Partial<Scenario>) => {
    setScenario((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setScenario(freshScenario()), []);

  return { scenario, update, reset };
}
