import { describe, expect, it } from 'vitest';
import { cityById } from '../data/cities';
import { medianAnnual } from './basket';
import { forward } from './forward';
import { requiredGross } from './solve';
import type { FilingStatus } from './types';

/**
 * The correctness bar from the brief, section 8.
 *
 * Every expected value moves with FX, so the rates are parameters rather than
 * constants baked into the expectations. Change RATES and the derived targets
 * move with them; the assertions still describe the same scenario.
 */
const RATES = { SGD: 0.9, USD: 0.71 } as const;
const toLocal = (aud: number, currency: keyof typeof RATES) => aud * RATES[currency];
const fxToHome = (currency: keyof typeof RATES) => 1 / RATES[currency];

/** The user in the brief: a Sydney senior with a meaningful equity component. */
const BASELINE = { base: 181_500, equity: 130_000 };
const GROSS = BASELINE.base + BASELINE.equity;

const sydney = cityById('sydney');
const singapore = cityById('singapore');
const sanFrancisco = cityById('san-francisco');

const sydneyBaseline = forward({
  city: sydney,
  grossComp: GROSS,
  filingStatus: 'single',
  preTaxDeductions: 0,
  livingCost: 99_000,
  healthCost: 0,
  fxToHome: 1,
});

/**
 * Scale mode: the user's actual Sydney spend against the Sydney medians. The
 * same factor prices every other city's basket, so the comparison is between
 * this person's life, not between two published averages.
 */
const SCALE = 99_000 / medianAnnual(sydney);

describe('Sydney baseline', () => {
  it('nets about A$199,000 on A$181,500 base plus A$130,000 equity', () => {
    expect(sydneyBaseline.netIncome).toBeGreaterThan(198_500);
    expect(sydneyBaseline.netIncome).toBeLessThan(199_500);
  });

  it('lands an effective rate near 36% including the Medicare levy', () => {
    expect(sydneyBaseline.effectiveTaxRate).toBeGreaterThan(0.355);
    expect(sydneyBaseline.effectiveTaxRate).toBeLessThan(0.365);
    expect(sydneyBaseline.levies).toBeCloseTo(GROSS * 0.02, 6);
  });

  it('leaves about A$100,000 surplus against A$99,000 of costs', () => {
    expect(sydneyBaseline.surplusLocal).toBeGreaterThan(99_500);
    expect(sydneyBaseline.surplusLocal).toBeLessThan(100_500);
    // Home city, home currency: the conversion is the identity.
    expect(sydneyBaseline.surplusHome).toBe(sydneyBaseline.surplusLocal);
  });

  it('adds superannuation on top of salary, net of contributions tax', () => {
    expect(sydneyBaseline.employerRetirement).toBeCloseTo(GROSS * 0.12, 6);
    // Division 293: combined income is well past $250,000, so the whole
    // contribution is taxed at 30% rather than 15%.
    expect(sydneyBaseline.retirementTax).toBeCloseTo(GROSS * 0.12 * 0.3, 6);
    expect(sydneyBaseline.totalValueHome).toBeGreaterThan(sydneyBaseline.surplusHome);
  });
});

describe('Singapore parity', () => {
  const livingCost = medianAnnual(singapore) * SCALE;

  it('prices the scaled basket at about S$103,000', () => {
    expect(livingCost).toBeGreaterThan(101_000);
    expect(livingCost).toBeLessThan(105_000);
  });

  const requiredFor = (targetAud: number) =>
    requiredGross(targetAud, 'surplusHome', {
      city: singapore,
      filingStatus: 'single',
      preTaxDeductions: 0,
      livingCost,
      healthCost: 0,
      fxToHome: fxToHome('SGD'),
    });

  it('needs about S$217,000 gross for an A$100,000 surplus', () => {
    expect(requiredFor(100_000)).toBeCloseTo(217_000, -3.5);
  });

  it('needs about S$240,000 gross for an A$120,000 surplus', () => {
    expect(requiredFor(120_000)).toBeCloseTo(240_000, -3.5);
  });

  it('converts the surplus back at the stated rate', () => {
    const gross = requiredFor(100_000);
    const result = forward({
      city: singapore,
      grossComp: gross,
      filingStatus: 'single',
      preTaxDeductions: 0,
      livingCost,
      healthCost: 0,
      fxToHome: fxToHome('SGD'),
    });
    expect(result.surplusLocal).toBeCloseTo(toLocal(100_000, 'SGD'), 4);
    expect(result.surplusHome).toBeCloseTo(100_000, 4);
  });

  it('has no mandatory retirement, because CPF does not apply on an EP', () => {
    expect(singapore.mandatoryRetirement).toBeNull();
  });
});

describe('San Francisco', () => {
  const basket = medianAnnual(sanFrancisco) * SCALE;
  const health = sanFrancisco.healthAnnualCost;

  it('prices the scaled basket plus health at about US$94,000', () => {
    expect(basket + health).toBeGreaterThan(92_000);
    expect(basket + health).toBeLessThan(96_000);
  });

  const requiredFor = (targetAud: number, filingStatus: FilingStatus) =>
    requiredGross(targetAud, 'surplusHome', {
      city: sanFrancisco,
      filingStatus,
      preTaxDeductions: 0,
      livingCost: basket,
      healthCost: health,
      fxToHome: fxToHome('USD'),
    });

  /**
   * The brief calls this the "sole earner" case. One earner in a couple files
   * jointly, which is what the US$224,000 and US$245,000 figures describe —
   * filing single at the same targets needs materially more, as the next test
   * asserts.
   */
  it('needs about US$224,000 gross for an A$100,000 surplus, filing jointly', () => {
    expect(requiredFor(100_000, 'married_joint')).toBeCloseTo(224_000, -3.5);
  });

  it('needs about US$245,000 gross for an A$120,000 surplus, filing jointly', () => {
    expect(requiredFor(120_000, 'married_joint')).toBeCloseTo(245_000, -3.5);
  });

  it('costs roughly US$30,000 more gross to hit the same target filing single', () => {
    const delta = requiredFor(100_000, 'single') - requiredFor(100_000, 'married_joint');
    expect(delta).toBeGreaterThan(20_000);
    expect(delta).toBeLessThan(40_000);
  });

  it('caps Social Security at the wage base and charges Medicare uncapped', () => {
    const result = forward({
      city: sanFrancisco,
      grossComp: 400_000,
      filingStatus: 'single',
      preTaxDeductions: 0,
      livingCost: 0,
      healthCost: 0,
      fxToHome: fxToHome('USD'),
    });
    const byId = Object.fromEntries(result.rules.map((r) => [r.id, r.amount]));
    expect(byId['us-social-security']).toBeCloseTo(184_500 * 0.062, 6);
    expect(byId['us-medicare']).toBeCloseTo(400_000 * 0.0145, 6);
    expect(byId['us-additional-medicare']).toBeCloseTo(200_000 * 0.009, 6);
  });
});

describe('FX parameterisation', () => {
  /**
   * The point of the product: the required gross is a function of the exchange
   * rate, not just of the tax code. A weaker home currency lowers the ask.
   */
  it('lowers the required gross when the home currency weakens', () => {
    const at = (rate: number) =>
      requiredGross(100_000, 'surplusHome', {
        city: singapore,
        filingStatus: 'single',
        preTaxDeductions: 0,
        livingCost: medianAnnual(singapore) * SCALE,
        healthCost: 0,
        fxToHome: 1 / rate,
      });
    expect(at(0.8)).toBeLessThan(at(0.9));
    expect(at(1.0)).toBeGreaterThan(at(0.9));
  });
});
