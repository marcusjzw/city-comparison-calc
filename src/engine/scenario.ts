import {
  basketTotal,
  buildBasket,
  deriveLivingCost,
  lifestyleParitySurplusLocal,
  medianAnnual,
  scaleFactorFor,
  type Basket,
} from './basket';
import { forward, splitComp, staleness } from './forward';
import { rateToHome, shiftFx, type FxTable } from './fx';
import {
  requiredAnnualSurplus,
  requiredGross,
  yearsToGoal,
  type GoalInput,
} from './solve';
import type { CityData, FilingStatus, ForwardResult, TargetMetric } from './types';

export type Mode = 'lifestyle' | 'savings' | 'goal';

export interface Scenario {
  homeCityId: string;
  current: { base: number; equity: number; annualSavings: number };
  /** Overrides the inferred home spend when the user corrects it. */
  homeSpendOverride: number | null;
  filingStatus: FilingStatus;
  preTaxDeductions: number;
  goal: GoalInput & { years: number };
  mode: Mode;
  /** "Count retirement savings toward the goal." Off by default. */
  countRetirement: boolean;
  /** Per city, per category, annual figures in city currency. */
  basketOverrides: Record<string, Record<string, number>>;
  /** Per city annual health cost override, in city currency. */
  healthOverrides: Record<string, number>;
  /** Per currency "what if the rate moves" shift, as a signed fraction. */
  fxShifts: Record<string, number>;
}

export interface CityOutcome {
  city: CityData;
  /** Required gross comp, in city currency. `Infinity` when unreachable. */
  requiredGross: number;
  requiredGrossHome: number;
  suggestedSplit: { base: number; equity: number };
  result: ForwardResult;
  basket: Basket;
  livingCost: number;
  /** Years to the goal at this comp. `Infinity` renders as "never at this rate". */
  years: number;
  fxToHome: number;
  freshness: ReturnType<typeof staleness>;
  isHome: boolean;
}

export interface Comparison {
  home: {
    city: CityData;
    result: ForwardResult;
    spend: number;
    spendWasInferred: boolean;
    scaleFactor: number;
    basketTotal: number;
    surplusHome: number;
  };
  metric: TargetMetric;
  /** The number every city is being solved against, in home currency. */
  targetHome: number;
  outcomes: CityOutcome[];
}

function fxFor(fx: FxTable, city: CityData, shifts: Record<string, number>): number {
  const shifted = shiftFx(fx, city.currency, shifts[city.currency] ?? 0);
  return rateToHome(shifted, city.currency);
}

/**
 * The whole comparison, in one pure function.
 *
 * Three questions, one pipeline:
 *  - lifestyle parity: the same standard of living, priced locally
 *  - savings parity: the same annual savings, in home-currency terms
 *  - goal: whatever surplus lands the target by the date
 */
export function compare(
  scenario: Scenario,
  cities: CityData[],
  fx: FxTable,
): Comparison {
  const homeCity = cities.find((c) => c.id === scenario.homeCityId) ?? cities[0];
  const metric: TargetMetric = scenario.countRetirement
    ? 'totalValueHome'
    : 'surplusHome';

  const homeGross = scenario.current.base + scenario.current.equity;
  const homeFx = fxFor(fx, homeCity, scenario.fxShifts);
  const homeHealth = scenario.healthOverrides[homeCity.id] ?? homeCity.healthAnnualCost;

  // One pass to get net income, since the inferred spend depends on it.
  const homeNet = forward({
    city: homeCity,
    grossComp: homeGross,
    filingStatus: scenario.filingStatus,
    preTaxDeductions: scenario.preTaxDeductions,
    livingCost: 0,
    healthCost: homeHealth,
    fxToHome: homeFx,
  }).netIncome;

  const spend =
    scenario.homeSpendOverride ??
    deriveLivingCost(homeNet, scenario.current.annualSavings);

  const homeResult = forward({
    city: homeCity,
    grossComp: homeGross,
    filingStatus: scenario.filingStatus,
    preTaxDeductions: scenario.preTaxDeductions,
    livingCost: spend,
    healthCost: homeHealth,
    fxToHome: homeFx,
  });

  const scaleFactor = scaleFactorFor(homeCity, spend);
  const homeSurplusHome = homeResult[metric];
  const homeBasketTotal = medianAnnual(homeCity) * scaleFactor;

  const goalSurplus = requiredAnnualSurplus(scenario.goal, scenario.goal.years);

  const outcomes = cities.map((city): CityOutcome => {
    const fxToHome = fxFor(fx, city, scenario.fxShifts);
    const basket = buildBasket(city, scaleFactor, scenario.basketOverrides[city.id]);
    const livingCost = basketTotal(basket);
    const healthCost = scenario.healthOverrides[city.id] ?? city.healthAnnualCost;

    const shared = {
      city,
      filingStatus: city.filingStatuses?.length
        ? scenario.filingStatus
        : ('single' as FilingStatus),
      preTaxDeductions: scenario.preTaxDeductions,
      livingCost,
      healthCost,
      fxToHome,
    };

    let target: number;
    let solveMetric: TargetMetric = metric;
    if (scenario.mode === 'lifestyle') {
      solveMetric = 'surplusLocal';
      target = lifestyleParitySurplusLocal(
        homeSurplusHome,
        homeBasketTotal,
        livingCost,
      );
    } else if (scenario.mode === 'savings') {
      target = homeSurplusHome;
    } else {
      target = goalSurplus;
    }

    const gross = requiredGross(target, solveMetric, shared);
    const result = forward({
      ...shared,
      grossComp: Number.isFinite(gross) ? gross : 2_000_000,
    });

    return {
      city,
      requiredGross: gross,
      requiredGrossHome: gross * fxToHome,
      suggestedSplit: splitComp(gross, scenario.current),
      result,
      basket,
      livingCost,
      years: yearsToGoal(result[metric], scenario.goal),
      fxToHome,
      freshness: staleness(city),
      isHome: city.id === homeCity.id,
    };
  });

  // Ranked by what the active mode optimises: the smallest ask that clears the
  // bar. Switching modes reorders this list, which is the point.
  outcomes.sort((a, b) => a.requiredGrossHome - b.requiredGrossHome);

  return {
    home: {
      city: homeCity,
      result: homeResult,
      spend,
      spendWasInferred: scenario.homeSpendOverride === null,
      scaleFactor,
      basketTotal: homeBasketTotal,
      surplusHome: homeSurplusHome,
    },
    metric,
    targetHome:
      scenario.mode === 'goal'
        ? goalSurplus
        : scenario.mode === 'savings'
          ? homeSurplusHome
          : homeSurplusHome,
    outcomes,
  };
}
