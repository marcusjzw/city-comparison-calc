import {
  basketTotal,
  buildBasket,
  lifestyleParitySurplusLocal,
  medianAnnual,
  scaleFactorFor,
  type Basket,
} from './basket';
import { forward, staleness } from './forward';
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
  /**
   * The currency every cross-city figure is reported in, and the unit the goal
   * is denominated in. Independent of the home city on purpose: a reader can
   * live in Sydney and still think in pounds.
   *
   * The engine never reads this — it works entirely off `fx.homeCurrency`, and
   * the two are kept in step by the caller. It lives here because it is part
   * of the scenario a shared link has to reproduce.
   */
  displayCurrency: string;
  /**
   * Total annual compensation, not a base/equity split. Every seeded city
   * taxes salary and vesting equity as ordinary income at the same rate, so
   * splitting them changed nothing in the answer and asked the reader for a
   * number most of them do not have.
   */
  current: { comp: number };
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

  const homeGross = scenario.current.comp;
  const homeFx = fxFor(fx, homeCity, scenario.fxShifts);
  const homeHealth = scenario.healthOverrides[homeCity.id] ?? homeCity.healthAnnualCost;

  // Living cost defaults to the home city's own median basket — a typical
  // spender, not a guess built from a savings figure nobody was asked for.
  const spend = scenario.homeSpendOverride ?? medianAnnual(homeCity);

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
      result,
      basket,
      livingCost,
      years: yearsToGoal(result[metric], scenario.goal),
      fxToHome,
      freshness: staleness(city),
      isHome: city.id === homeCity.id,
    };
  });

  // Fixed order: home city first, then the rest A-Z. Ranking by required
  // salary used to reorder the cards on every slider drag as the numbers
  // shifted — jarring mid-interaction. Callers that want the cheapest city
  // (the "leader") compute it separately, by value, not by array position.
  outcomes.sort((a, b) => {
    if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
    return a.city.name.localeCompare(b.city.name);
  });

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
