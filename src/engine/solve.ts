import { forward } from './forward';
import type { ForwardInput, ForwardResult, TargetMetric } from './types';

const MAX_GROSS = 2_000_000;
const BISECTION_STEPS = 60;

/**
 * Required gross comp to hit a target on a chosen metric.
 *
 * The forward function is monotonically non-decreasing in gross, so bisection
 * is exact enough, trivially correct, and survives any future rule. There is
 * deliberately no analytic inverse.
 *
 * Returns `Infinity` when the target is unreachable inside the search window,
 * which is a real answer, not an error.
 */
export function requiredGross(
  target: number,
  metric: TargetMetric,
  input: Omit<ForwardInput, 'grossComp'>,
): number {
  const at = (gross: number) => forward({ ...input, grossComp: gross })[metric];

  if (at(MAX_GROSS) < target) return Infinity;

  let lo = 0;
  let hi = MAX_GROSS;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

export interface GoalInput {
  /** Target amount in home currency, today's money. */
  target: number;
  /** How fast the thing you are saving for gets more expensive. */
  goalGrowthRate: number;
}

/**
 * Years until accumulated capital overtakes a target that is itself growing.
 *
 * Returns `Infinity` when it never happens. That is reported honestly as
 * "never at this rate" — it is the most useful thing the tool can say.
 */
export function yearsToGoal(
  annualSurplus: number,
  goal: GoalInput,
  maxYears = 60,
): number {
  const { target, goalGrowthRate } = goal;
  if (annualSurplus <= 0) return Infinity;

  let capital = 0;
  let goalAmount = target;

  for (let year = 1; year <= maxYears; year++) {
    const prevCapital = capital;
    const prevGoal = goalAmount;
    capital += annualSurplus;
    goalAmount *= 1 + goalGrowthRate;
    if (capital >= goalAmount) {
      // Linear interpolation inside the year. Both series are close to linear
      // over a single step, so this is accurate to a few days.
      const gapStart = prevGoal - prevCapital;
      const gapEnd = goalAmount - capital;
      const fraction = gapStart / (gapStart - gapEnd);
      return year - 1 + fraction;
    }
  }
  return Infinity;
}

/**
 * The annual surplus needed to land a growing target in exactly `years`.
 * Direct, because this one genuinely does have a closed form.
 */
export function requiredAnnualSurplus(goal: GoalInput, years: number): number {
  if (years <= 0) return Infinity;
  const grown = goal.target * Math.pow(1 + goal.goalGrowthRate, years);
  return Math.max(0, grown / years);
}

/**
 * Rank the cost basket by how much a 10% move in each category shifts the
 * headline number. Housing dominates everywhere, which is itself the insight:
 * it tells the user which number to go and research properly.
 */
export function categorySensitivity(
  input: Omit<ForwardInput, 'grossComp' | 'livingCost'>,
  grossComp: number,
  categories: { id: string; label: string; annual: number }[],
  metric: TargetMetric = 'surplusHome',
  delta = 0.1,
): { id: string; label: string; annual: number; impact: number }[] {
  const total = categories.reduce((t, c) => t + c.annual, 0);
  const baseline = forward({ ...input, grossComp, livingCost: total })[metric];

  return categories
    .map((category) => {
      const bumped = forward({
        ...input,
        grossComp,
        livingCost: total + category.annual * delta,
      })[metric];
      return { ...category, impact: Math.abs(baseline - bumped) };
    })
    .sort((a, b) => b.impact - a.impact);
}

/** Total tax as a share of gross, for the small supporting-evidence line. */
export function effectiveRate(result: ForwardResult): number {
  return result.effectiveTaxRate;
}
