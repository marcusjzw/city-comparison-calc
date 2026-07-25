import type { CategoryDefault, CityData } from './types';

export interface BasketLine {
  id: string;
  label: string;
  confidence: CategoryDefault['confidence'];
  note?: string;
  /** Annual, in city currency. */
  median: number;
  /** Annual, in city currency. What the user is actually modelling. */
  annual: number;
  /** annual / median. 1 means exactly typical. */
  vsMedian: number;
}

export type Basket = BasketLine[];

export function medianAnnual(city: CityData): number {
  return city.colBasket.reduce((t, c) => t + c.monthlyMedian, 0) * 12;
}

/**
 * Scale mode. The user states their current total spend at home; every city's
 * basket is scaled by the same factor against its own medians.
 *
 * The factor carries the user's own habits across cities (someone who spends
 * 1.3x the Sydney median will spend about 1.3x the Singapore median), while
 * the median ratios carry both the local price level and the exchange rate.
 * Fast, and a good default. `overrides` is basket mode: slower, far more
 * accurate, and what turns this from a toy into a tool.
 */
export function buildBasket(
  city: CityData,
  scaleFactor: number,
  overrides: Record<string, number> = {},
): Basket {
  return city.colBasket.map((category) => {
    const median = category.monthlyMedian * 12;
    const annual = overrides[category.id] ?? median * scaleFactor;
    return {
      id: category.id,
      label: category.label,
      confidence: category.confidence,
      note: category.note,
      median,
      annual,
      vsMedian: median > 0 ? annual / median : 1,
    };
  });
}

export function basketTotal(basket: Basket): number {
  return basket.reduce((t, line) => t + line.annual, 0);
}

/**
 * People know what they save far better than they know what they spend, so
 * living cost is inferred rather than asked for. The UI shows the derived
 * figure and lets them correct it.
 */
export function deriveLivingCost(netIncome: number, annualSavings: number): number {
  return Math.max(0, netIncome - annualSavings);
}

/** The scale factor implied by a user's actual spend in their home city. */
export function scaleFactorFor(homeCity: CityData, annualSpend: number): number {
  const median = medianAnnual(homeCity);
  return median > 0 ? annualSpend / median : 1;
}

/**
 * Lifestyle parity target: the same standard of living, not the same savings.
 *
 * The discretionary buffer scales with local prices rather than with the
 * exchange rate, so a home-currency surplus is converted through the ratio of
 * the two cities' baskets rather than through FX.
 */
export function lifestyleParitySurplusLocal(
  homeSurplusHome: number,
  homeBasketTotal: number,
  cityBasketTotal: number,
): number {
  if (homeBasketTotal <= 0) return homeSurplusHome;
  return homeSurplusHome * (cityBasketTotal / homeBasketTotal);
}
