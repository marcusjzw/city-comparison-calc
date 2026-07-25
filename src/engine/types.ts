/**
 * Roundtrip calculation engine — types.
 *
 * Zero DOM dependencies. Nothing in `src/engine` may import React, Vite, or
 * anything from `src/ui`. The UI is a skin over this module.
 */

export type FilingStatus = 'single' | 'married_joint';

/** A marginal bracket. Ordered ascending; the final entry has `upTo: null`. */
export interface Bracket {
  upTo: number | null;
  rate: number;
}

/**
 * Which income figure a rule is applied to.
 *
 * - `gross`                 gross comp, before any deduction
 * - `taxableAfterDeduction` gross comp less scenario-level pre-tax deductions
 * - `wages`                 cash wages subject to payroll tax (FICA and friends)
 *
 * Rule-level allowances (a federal or state standard deduction) are subtracted
 * *inside* the rule, because US federal and California disagree about theirs.
 */
export type TaxBase = 'gross' | 'taxableAfterDeduction' | 'wages';

/** Which line of the result a rule's output is reported under. */
export type TaxCategory = 'income' | 'levy' | 'payroll';

interface RuleCommon {
  id: string;
  label: string;
  base: TaxBase;
  category: TaxCategory;
  /** Shown in the drill-down. Where the rule is a simplification, say so here. */
  note?: string;
}

/** Standard marginal bracket walk. */
export interface BracketsRule extends RuleCommon {
  kind: 'brackets';
  brackets: Bracket[];
  standardDeduction?: number;
  /**
   * Per-filing-status overrides. Joint bands are close to double the single
   * ones but not exactly, so they are stated rather than derived.
   */
  byStatus?: Partial<
    Record<FilingStatus, { brackets: Bracket[]; standardDeduction?: number }>
  >;
}

/**
 * A flat rate on the whole base.
 * - `appliesAbove` — the rule does not apply at all below this income; above
 *   it, the rate applies to the *whole* base (Medicare levy shape).
 * - `cappedAt` — the base is capped before the rate is applied (FICA wage base).
 */
export interface FlatRule extends RuleCommon {
  kind: 'flat';
  rate: number;
  appliesAbove?: number;
  cappedAt?: number;
}

/** A rate on the excess above a threshold (US Additional Medicare shape). */
export interface SurchargeRule extends RuleCommon {
  kind: 'surcharge';
  rate: number;
  threshold: number;
  byStatus?: Partial<Record<FilingStatus, { threshold: number }>>;
}

export type TaxRule = BracketsRule | FlatRule | SurchargeRule;

export type Confidence = 'institutional' | 'derived' | 'estimated';

export interface CategoryDefault {
  id: string;
  label: string;
  /** Median monthly spend for a professional household, in city currency. */
  monthlyMedian: number;
  confidence: Confidence;
  note?: string;
}

export interface MandatoryRetirement {
  /** Employer contribution as a share of gross comp, paid on top of salary. */
  employerRate: number;
  contributionTaxRate: number;
  /** AU Division 293: contributions above this combined income are taxed higher. */
  surchargeThreshold?: number;
  surchargeRate?: number;
}

export interface SourceRef {
  label: string;
  url: string;
}

export interface CityData {
  id: string;
  name: string;
  country: string;
  currency: string;
  /** "2025-26", "YA2026", "2026" */
  taxYearLabel: string;
  /** ISO date the figures were last checked. */
  asOf: string;
  /**
   * True only once every figure has been read off the primary source listed in
   * `sources`. Seed data collected second-hand ships as `false` and says so in
   * the UI, because stale data that looks current is the failure mode this
   * whole provenance apparatus exists to prevent.
   */
  verified: boolean;
  /** Days after `asOf` before the record is treated as stale. */
  freshnessDays: number;
  sources: SourceRef[];
  taxRules: TaxRule[];
  /** Omitted where the country taxes individuals only. */
  filingStatuses?: FilingStatus[];
  payroll: TaxRule[];
  /**
   * Rule ids this city is not allowed to ship without. Makes the federal +
   * state composition explicit, so a future US city cannot silently ship
   * without its state layer.
   */
  requiredRules: string[];
  mandatoryRetirement: MandatoryRetirement | null;
  /** Employee premium plus expected out-of-pocket, in city currency, annual. */
  healthAnnualCost: number;
  healthNote?: string;
  colBasket: CategoryDefault[];
  notes?: string[];
}

/* ------------------------------------------------------------------ */
/* Computation inputs and outputs                                      */
/* ------------------------------------------------------------------ */

export interface CompPackage {
  base: number;
  /** Annualised value of equity. Ordinary income at vest in all three cities. */
  equity: number;
}

export interface ForwardInput {
  city: CityData;
  grossComp: number;
  filingStatus: FilingStatus;
  /** Salary sacrifice, 401k, and the like. Zero by default. */
  preTaxDeductions: number;
  /** Annual living cost in city currency, excluding `healthAnnualCost`. */
  livingCost: number;
  /** Annual health cost in city currency. Defaults to the city figure. */
  healthCost: number;
  /** Units of home currency per one unit of city currency. */
  fxToHome: number;
}

export interface BracketBand {
  from: number;
  to: number | null;
  rate: number;
  /** Income falling inside this band. */
  taxed: number;
  /** Tax paid on this band. */
  tax: number;
  /** True where the taxpayer's income lands in this band. */
  active: boolean;
}

export interface RuleResult {
  id: string;
  label: string;
  category: TaxCategory;
  note?: string;
  /** The income figure this rule was applied to, after its own deduction. */
  appliedTo: number;
  deduction: number;
  amount: number;
  bands?: BracketBand[];
}

export interface ForwardResult {
  city: CityData;
  currency: string;
  grossComp: number;
  preTaxDeductions: number;
  taxableIncome: number;

  rules: RuleResult[];
  incomeTax: number;
  levies: number;
  payrollTax: number;
  healthCost: number;
  totalTax: number;

  netIncome: number;
  livingCost: number;
  surplusLocal: number;
  surplusHome: number;

  employerRetirement: number;
  retirementTax: number;
  retirementNetOfTax: number;
  retirementHome: number;

  totalValueHome: number;
  /** (incomeTax + levies + payrollTax) / grossComp */
  effectiveTaxRate: number;
  fxToHome: number;
}

/** Which figure a solve or a goal is measured against. */
export type TargetMetric = 'surplusLocal' | 'surplusHome' | 'totalValueHome';
