import { describe, expect, it } from 'vitest';
import { cityById } from '../data/cities';
import { applyRule, progressiveTax, walkBrackets } from './tax';
import type { Bracket, BracketsRule, FlatRule, SurchargeRule } from './types';

const LADDER: Bracket[] = [
  { upTo: 10_000, rate: 0 },
  { upTo: 20_000, rate: 0.2 },
  { upTo: null, rate: 0.5 },
];

describe('progressive tax', () => {
  it('taxes nothing below the first threshold', () => {
    expect(progressiveTax(9_999, LADDER)).toBe(0);
  });

  it('taxes only the excess in each band', () => {
    expect(progressiveTax(15_000, LADDER)).toBe(1_000);
    expect(progressiveTax(20_000, LADDER)).toBe(2_000);
    expect(progressiveTax(30_000, LADDER)).toBe(7_000);
  });

  it('reports a band walk that sums to the total', () => {
    const bands = walkBrackets(30_000, LADDER);
    expect(bands).toHaveLength(3);
    expect(bands.reduce((t, b) => t + b.tax, 0)).toBe(7_000);
    expect(bands.map((b) => b.active)).toEqual([true, true, true]);
    expect(walkBrackets(15_000, LADDER).map((b) => b.active)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('is monotonically non-decreasing, which is what the bisection relies on', () => {
    let previous = -1;
    for (let income = 0; income <= 500_000; income += 2_500) {
      const tax = progressiveTax(income, LADDER);
      expect(tax).toBeGreaterThanOrEqual(previous);
      previous = tax;
    }
  });
});

describe('bracket convention', () => {
  /**
   * The trap from the ingestion notes: Australia is published upstream as 15%
   * from $0 with a separate $18,200 allowance, which is the ATO ladder minus
   * the tax-free threshold. Both conventions are correct and neither errors if
   * confused, so the convention is asserted rather than commented.
   */
  it('states Australian thresholds on gross taxable income, allowance included', () => {
    const rule = cityById('sydney').taxRules[0] as BracketsRule;
    expect(rule.standardDeduction ?? 0).toBe(0);
    expect(rule.brackets[0]).toEqual({ upTo: 18_200, rate: 0 });
    expect(progressiveTax(18_200, rule.brackets)).toBe(0);
    expect(progressiveTax(19_200, rule.brackets)).toBeCloseTo(160, 6);
  });

  it('states US federal thresholds after the standard deduction, applied in-rule', () => {
    const rule = cityById('san-francisco').taxRules[0] as BracketsRule;
    expect(rule.standardDeduction).toBe(16_100);
    // Gross of exactly the deduction leaves nothing to tax.
    expect(applyRule(rule, 16_100, 'single').amount).toBe(0);
    expect(applyRule(rule, 17_100, 'single').amount).toBeCloseTo(100, 6);
  });
});

describe('rule kinds', () => {
  const flat: FlatRule = {
    id: 'f',
    label: 'Flat',
    kind: 'flat',
    base: 'wages',
    category: 'payroll',
    rate: 0.1,
    cappedAt: 100_000,
  };

  it('caps a flat rate at its wage base', () => {
    expect(applyRule(flat, 50_000, 'single').amount).toBe(5_000);
    expect(applyRule(flat, 500_000, 'single').amount).toBe(10_000);
  });

  it('switches a flat rate on only above its threshold, then charges the lot', () => {
    const levy: FlatRule = { ...flat, cappedAt: undefined, appliesAbove: 30_000 };
    expect(applyRule(levy, 30_000, 'single').amount).toBe(0);
    expect(applyRule(levy, 40_000, 'single').amount).toBe(4_000);
  });

  it('charges a surcharge on the excess only, and varies by filing status', () => {
    const surcharge: SurchargeRule = {
      id: 's',
      label: 'Additional Medicare',
      kind: 'surcharge',
      base: 'wages',
      category: 'payroll',
      rate: 0.009,
      threshold: 200_000,
      byStatus: { married_joint: { threshold: 250_000 } },
    };
    expect(applyRule(surcharge, 300_000, 'single').amount).toBeCloseTo(900, 6);
    expect(applyRule(surcharge, 300_000, 'married_joint').amount).toBeCloseTo(450, 6);
  });
});
