import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, resolveComp } from './useScenario';

/**
 * Compensation used to be a base/equity pair. Links minted then are already
 * shared, bookmarked and sitting in people's localStorage, so folding them into
 * the single figure is a compatibility promise, not a nicety.
 */
describe('resolveComp', () => {
  it('sums a legacy base and equity pair into one figure', () => {
    expect(resolveComp({ base: 181_500, equity: 130_000, annualSavings: 100_000 })).toEqual(
      { comp: 311_500, annualSavings: 100_000 },
    );
  });

  it('treats a missing half of a legacy pair as zero, not as a default salary', () => {
    expect(resolveComp({ base: 120_000, annualSavings: 40_000 })).toEqual({
      comp: 120_000,
      annualSavings: 40_000,
    });
    expect(resolveComp({ equity: 90_000, annualSavings: 40_000 })).toEqual({
      comp: 90_000,
      annualSavings: 40_000,
    });
  });

  it('passes a current-format figure straight through', () => {
    expect(resolveComp({ comp: 250_000, annualSavings: 80_000 })).toEqual({
      comp: 250_000,
      annualSavings: 80_000,
    });
  });

  it('prefers comp over a stale base/equity pair on a doubly-encoded link', () => {
    expect(
      resolveComp({ comp: 250_000, base: 1, equity: 2, annualSavings: 80_000 }),
    ).toEqual({ comp: 250_000, annualSavings: 80_000 });
  });

  it('keeps a savings figure even when the comp half is unreadable', () => {
    expect(resolveComp({ annualSavings: 55_000 })).toEqual({
      comp: DEFAULT_SCENARIO.current.comp,
      annualSavings: 55_000,
    });
  });

  it('falls back whole when there is nothing usable', () => {
    expect(resolveComp(null)).toEqual(DEFAULT_SCENARIO.current);
    expect(resolveComp('nonsense')).toEqual(DEFAULT_SCENARIO.current);
  });
});
