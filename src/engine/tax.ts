import type {
  Bracket,
  BracketBand,
  BracketsRule,
  FilingStatus,
  RuleResult,
  TaxRule,
} from './types';

/**
 * Walk a marginal bracket ladder.
 *
 * Brackets are stated as thresholds on the income *fed to this function*. A
 * rule's own allowance (standard deduction) is subtracted before the walk, so
 * the caller must be explicit about which convention its data uses. See
 * `docs/DATA.md` — the upstream bracket-convention trap is real and silent.
 */
export function walkBrackets(income: number, brackets: Bracket[]): BracketBand[] {
  const bands: BracketBand[] = [];
  let floor = 0;
  for (const bracket of brackets) {
    const ceiling = bracket.upTo ?? Infinity;
    const taxed = Math.max(0, Math.min(income, ceiling) - floor);
    bands.push({
      from: floor,
      to: bracket.upTo,
      rate: bracket.rate,
      taxed,
      tax: taxed * bracket.rate,
      active: income > floor,
    });
    floor = ceiling;
    if (!Number.isFinite(ceiling)) break;
  }
  return bands;
}

export function progressiveTax(income: number, brackets: Bracket[]): number {
  return walkBrackets(income, brackets).reduce((sum, band) => sum + band.tax, 0);
}

function bracketsFor(
  rule: BracketsRule,
  status: FilingStatus,
): { brackets: Bracket[]; standardDeduction: number } {
  const override = rule.byStatus?.[status];
  return {
    brackets: override?.brackets ?? rule.brackets,
    standardDeduction: override?.standardDeduction ?? rule.standardDeduction ?? 0,
  };
}

/** Apply one rule to one income figure. Pure; no knowledge of the pipeline. */
export function applyRule(
  rule: TaxRule,
  income: number,
  status: FilingStatus,
): RuleResult {
  const common = {
    id: rule.id,
    label: rule.label,
    category: rule.category,
    note: rule.note,
  };

  switch (rule.kind) {
    case 'brackets': {
      const { brackets, standardDeduction } = bracketsFor(rule, status);
      const applied = Math.max(0, income - standardDeduction);
      const bands = walkBrackets(applied, brackets);
      return {
        ...common,
        appliedTo: applied,
        deduction: standardDeduction,
        amount: bands.reduce((sum, band) => sum + band.tax, 0),
        bands,
      };
    }
    case 'flat': {
      const below = rule.appliesAbove !== undefined && income <= rule.appliesAbove;
      const applied = below ? 0 : Math.min(income, rule.cappedAt ?? Infinity);
      return {
        ...common,
        appliedTo: applied,
        deduction: 0,
        amount: applied * rule.rate,
      };
    }
    case 'surcharge': {
      const threshold = rule.byStatus?.[status]?.threshold ?? rule.threshold;
      const applied = Math.max(0, income - threshold);
      return {
        ...common,
        appliedTo: applied,
        deduction: threshold,
        amount: applied * rule.rate,
      };
    }
  }
}
