import { useCallback, useEffect, useState } from 'react';
import { FALLBACK_CURRENCY, isSupportedCurrency } from '../data/currencies';
import type { Scenario } from '../engine/scenario';
import { detectCurrencyFromEnvironment } from '../lib/detectCurrency';

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

  useEffect(() => {
    const encoded = encode(scenario);
    try {
      localStorage.setItem(STORAGE_KEY, encoded);
    } catch {
      // Private browsing. The session still works, it just will not persist.
    }
    // replaceState rather than a hash assignment: this must not spam history.
    window.history.replaceState(null, '', `#s=${encoded}`);
  }, [scenario]);

  const update = useCallback((patch: Partial<Scenario>) => {
    setScenario((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setScenario(freshScenario()), []);

  return { scenario, update, reset };
}
