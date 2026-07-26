import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, resolveComp } from './useScenario';

/**
 * Compensation used to be a base/equity pair, and the scenario used to carry
 * an `annualSavings` figure. Links minted then are already shared, bookmarked
 * and sitting in people's localStorage, so folding the comp half into the
 * single figure is a compatibility promise; the savings half is simply
 * dropped now that living cost no longer depends on it.
 */
describe('resolveComp', () => {
  it('sums a legacy base and equity pair into one figure', () => {
    expect(resolveComp({ base: 181_500, equity: 130_000, annualSavings: 100_000 })).toEqual(
      { comp: 311_500 },
    );
  });

  it('treats a missing half of a legacy pair as zero, not as a default salary', () => {
    expect(resolveComp({ base: 120_000 })).toEqual({ comp: 120_000 });
    expect(resolveComp({ equity: 90_000 })).toEqual({ comp: 90_000 });
  });

  it('passes a current-format figure straight through', () => {
    expect(resolveComp({ comp: 250_000 })).toEqual({ comp: 250_000 });
  });

  it('prefers comp over a stale base/equity pair on a doubly-encoded link', () => {
    expect(resolveComp({ comp: 250_000, base: 1, equity: 2 })).toEqual({ comp: 250_000 });
  });

  it('drops a legacy savings figure when the comp half is unreadable', () => {
    expect(resolveComp({ annualSavings: 55_000 })).toEqual(DEFAULT_SCENARIO.current);
  });

  it('falls back whole when there is nothing usable', () => {
    expect(resolveComp(null)).toEqual(DEFAULT_SCENARIO.current);
    expect(resolveComp('nonsense')).toEqual(DEFAULT_SCENARIO.current);
  });
});
