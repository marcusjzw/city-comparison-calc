import { useCallback, useEffect, useState } from 'react';
import type { Scenario } from '../engine/scenario';

/** The user in the brief: a Sydney senior with meaningful equity and a deposit in mind. */
export const DEFAULT_SCENARIO: Scenario = {
  homeCityId: 'sydney',
  current: { base: 181_500, equity: 130_000, annualSavings: 100_000 },
  homeSpendOverride: null,
  filingStatus: 'married_joint',
  preTaxDeductions: 0,
  goal: {
    target: 400_000,
    existingCapital: 60_000,
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

function decode(raw: string): Scenario | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(raw))) as Partial<Scenario>;
    if (!parsed || typeof parsed !== 'object' || !parsed.homeCityId) return null;
    // Merge over the defaults so an older link missing a newer field still opens.
    return { ...DEFAULT_SCENARIO, ...parsed, goal: { ...DEFAULT_SCENARIO.goal, ...parsed.goal } };
  } catch {
    return null;
  }
}

function initial(): Scenario {
  const fromHash = window.location.hash.startsWith('#s=')
    ? decode(window.location.hash.slice(3))
    : null;
  if (fromHash) return fromHash;
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved && decode(saved)) || DEFAULT_SCENARIO;
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

  const reset = useCallback(() => setScenario(DEFAULT_SCENARIO), []);

  return { scenario, update, reset };
}
