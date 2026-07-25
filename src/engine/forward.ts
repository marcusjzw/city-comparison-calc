import { applyRule } from './tax';
import type {
  CityData,
  ForwardInput,
  ForwardResult,
  MandatoryRetirement,
  RuleResult,
  TaxBase,
} from './types';

function baseIncome(base: TaxBase, gross: number, taxable: number): number {
  switch (base) {
    case 'gross':
      return gross;
    case 'taxableAfterDeduction':
      return taxable;
    case 'wages':
      // Base plus equity is ordinary wage income in all three seeded cities.
      // Pre-tax deductions such as 401k are not exempt from FICA, so payroll
      // rules read gross rather than the post-deduction figure.
      return gross;
  }
}

/**
 * Employer retirement contribution and the tax taken out of it on the way in.
 *
 * Australia's Division 293 doubles the contributions tax from 15% to 30% on
 * contributions that sit above the combined-income threshold, not on all of
 * them, so the split is modelled rather than approximated.
 */
export function retirementContribution(
  gross: number,
  scheme: MandatoryRetirement | null,
): { contribution: number; tax: number } {
  if (!scheme) return { contribution: 0, tax: 0 };
  const contribution = gross * scheme.employerRate;
  const { surchargeThreshold, surchargeRate, contributionTaxRate } = scheme;

  if (surchargeThreshold === undefined || surchargeRate === undefined) {
    return { contribution, tax: contribution * contributionTaxRate };
  }

  const combined = gross + contribution;
  const excess = Math.max(0, Math.min(contribution, combined - surchargeThreshold));
  const tax =
    excess * surchargeRate + (contribution - excess) * contributionTaxRate;
  return { contribution, tax };
}

/** The whole pipeline, for one city at one gross comp. */
export function forward(input: ForwardInput): ForwardResult {
  const { city, grossComp, filingStatus, preTaxDeductions } = input;
  const taxableIncome = Math.max(0, grossComp - preTaxDeductions);

  const rules: RuleResult[] = [...city.taxRules, ...city.payroll].map((rule) =>
    applyRule(rule, baseIncome(rule.base, grossComp, taxableIncome), filingStatus),
  );

  const sum = (category: RuleResult['category']) =>
    rules.filter((r) => r.category === category).reduce((t, r) => t + r.amount, 0);

  const incomeTax = sum('income');
  const levies = sum('levy');
  const payrollTax = sum('payroll');
  const totalTax = incomeTax + levies + payrollTax;

  const healthCost = input.healthCost;
  const netIncome = grossComp - totalTax - healthCost;
  const surplusLocal = netIncome - input.livingCost;
  const surplusHome = surplusLocal * input.fxToHome;

  const { contribution, tax: retirementTax } = retirementContribution(
    grossComp,
    city.mandatoryRetirement,
  );
  const retirementNetOfTax = contribution - retirementTax;
  const retirementHome = retirementNetOfTax * input.fxToHome;

  return {
    city,
    currency: city.currency,
    grossComp,
    preTaxDeductions,
    taxableIncome,
    rules,
    incomeTax,
    levies,
    payrollTax,
    healthCost,
    totalTax,
    netIncome,
    livingCost: input.livingCost,
    surplusLocal,
    surplusHome,
    employerRetirement: contribution,
    retirementTax,
    retirementNetOfTax,
    retirementHome,
    totalValueHome: surplusHome + retirementHome,
    effectiveTaxRate: grossComp > 0 ? totalTax / grossComp : 0,
    fxToHome: input.fxToHome,
  };
}

/** Split a gross figure into base and equity on the user's current ratio. */
export function splitComp(
  gross: number,
  current: { base: number; equity: number },
): { base: number; equity: number } {
  const total = current.base + current.equity;
  const equityShare = total > 0 ? current.equity / total : 0;
  return { base: gross * (1 - equityShare), equity: gross * equityShare };
}

/** Convenience: is this record past its freshness window, or twice it. */
export function staleness(
  city: CityData,
  now = new Date(),
): 'fresh' | 'stale' | 'unverified' {
  const age = (now.getTime() - new Date(city.asOf).getTime()) / 86_400_000;
  if (age > city.freshnessDays * 2) return 'unverified';
  if (age > city.freshnessDays) return 'stale';
  return 'fresh';
}
