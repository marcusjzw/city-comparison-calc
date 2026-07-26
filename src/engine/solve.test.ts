import { describe, expect, it } from 'vitest';
import { cityById } from '../data/cities';
import { forward } from './forward';
import {
  categorySensitivity,
  requiredAnnualSurplus,
  requiredGross,
  yearsToGoal,
} from './solve';
import type { ForwardInput } from './types';

const shared: Omit<ForwardInput, 'grossComp'> = {
  city: cityById('sydney'),
  filingStatus: 'single',
  preTaxDeductions: 0,
  livingCost: 99_000,
  healthCost: 0,
  fxToHome: 1,
};

describe('reverse solve', () => {
  it('round-trips: solving for a surplus and running it forward returns it', () => {
    for (const target of [10_000, 50_000, 100_000, 250_000]) {
      const gross = requiredGross(target, 'surplusHome', shared);
      expect(forward({ ...shared, grossComp: gross }).surplusHome).toBeCloseTo(target, 3);
    }
  });

  it('returns Infinity rather than a wrong number when a target is unreachable', () => {
    expect(requiredGross(5_000_000, 'surplusHome', shared)).toBe(Infinity);
  });

  it('needs less gross when retirement counts toward the goal', () => {
    const withoutSuper = requiredGross(100_000, 'surplusHome', shared);
    const withSuper = requiredGross(100_000, 'totalValueHome', shared);
    expect(withSuper).toBeLessThan(withoutSuper);
  });
});

describe('years to goal', () => {
  const goal = { target: 300_000, goalGrowthRate: 0 };

  it('counts a flat target in whole years', () => {
    expect(yearsToGoal(50_000, goal)).toBeCloseTo(6, 6);
  });

  it('returns a fractional year mid-way', () => {
    const years = yearsToGoal(90_000, goal);
    expect(years).toBeGreaterThan(3);
    expect(years).toBeLessThan(4);
  });

  it('takes longer once the target grows', () => {
    const growing = { ...goal, goalGrowthRate: 0.05 };
    expect(yearsToGoal(50_000, growing)).toBeGreaterThan(yearsToGoal(50_000, goal));
  });

  it('says never, honestly, when the target outruns the surplus', () => {
    // A A$300,000 target growing at 5% gains A$15,000 in the first year alone.
    expect(yearsToGoal(9_000, { ...goal, goalGrowthRate: 0.05 })).toBe(Infinity);
    expect(yearsToGoal(0, goal)).toBe(Infinity);
    expect(yearsToGoal(-5_000, goal)).toBe(Infinity);
  });

  it('agrees with the closed-form surplus needed to land on a date', () => {
    const g = { target: 300_000, goalGrowthRate: 0.05 };
    const surplus = requiredAnnualSurplus(g, 4);
    expect(yearsToGoal(surplus, g)).toBeCloseTo(4, 1);
  });
});

describe('category sensitivity', () => {
  it('ranks housing first, which is the insight, not an accident', () => {
    const categories = [
      { id: 'housing', label: 'Housing', annual: 36_000 },
      { id: 'groceries', label: 'Groceries', annual: 12_000 },
      { id: 'transport', label: 'Transport', annual: 4_800 },
    ];
    const ranked = categorySensitivity(
      { ...shared, healthCost: 0 },
      311_500,
      categories,
    );
    expect(ranked.map((r) => r.id)).toEqual(['housing', 'groceries', 'transport']);
    // A 10% move in a A$36,000 line is A$3,600 of surplus, one for one.
    expect(ranked[0].impact).toBeCloseTo(3_600, 6);
  });
});
