import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { SEED_FX } from '../data/fx';
import { rateToHome, shiftFx } from './fx';
import { validateCity } from './validate';

const BASKET_CATEGORIES = [
  'housing',
  'groceries',
  'dining',
  'transport',
  'utilities',
  'health',
  'childcare',
  'leisure',
  'travel',
  'other',
];

describe.each(CITIES)('$name', (city) => {
  it('passes every ingestion invariant', () => {
    expect(validateCity(city)).toEqual([]);
  });

  it('ships provenance: an asOf date and at least one primary source link', () => {
    expect(city.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(city.sources.length).toBeGreaterThan(0);
    for (const source of city.sources) expect(source.url).toMatch(/^https:\/\//);
  });

  it('ships the full ten-category basket with a confidence on every line', () => {
    expect(city.colBasket.map((c) => c.id)).toEqual(BASKET_CATEGORIES);
    for (const category of city.colBasket) {
      expect(category.monthlyMedian).toBeGreaterThan(0);
      expect(['institutional', 'derived', 'estimated']).toContain(category.confidence);
    }
  });

  it('has an FX quote against the home currency', () => {
    expect(() => rateToHome(SEED_FX, city.currency)).not.toThrow();
  });
});

describe('residency-status qualifiers', () => {
  /**
   * Every social security field upstream describes the default resident, not
   * this app's user. Both of these are asserted because both have a plausible
   * wrong answer that would never throw.
   */
  it('gives Singapore no CPF, because the user is on an Employment Pass', () => {
    const singapore = CITIES.find((c) => c.id === 'singapore')!;
    expect(singapore.mandatoryRetirement).toBeNull();
    expect(singapore.payroll).toEqual([]);
  });

  it('gives Australia employer super, which the employee-side view misses', () => {
    const sydney = CITIES.find((c) => c.id === 'sydney')!;
    expect(sydney.payroll).toEqual([]);
    expect(sydney.mandatoryRetirement?.employerRate).toBe(0.12);
  });

  it('gives San Francisco a state layer, not federal only', () => {
    const sf = CITIES.find((c) => c.id === 'san-francisco')!;
    expect(sf.requiredRules).toContain('us-california');
    expect(sf.taxRules.some((r) => r.id === 'us-california')).toBe(true);
  });
});

describe('filing status', () => {
  it('is declared only where the jurisdiction actually offers it', () => {
    const declared = CITIES.filter((c) => c.filingStatuses?.length).map((c) => c.id);
    expect(declared).toEqual(['san-francisco']);
  });
});

describe('validator', () => {
  const sydney = CITIES.find((c) => c.id === 'sydney')!;

  it('rejects an unsorted bracket ladder', () => {
    const broken = structuredClone(sydney);
    const rule = broken.taxRules[0];
    if (rule.kind !== 'brackets') throw new Error('unexpected rule kind');
    rule.brackets = [
      { upTo: 45_000, rate: 0.16 },
      { upTo: 18_200, rate: 0 },
      { upTo: null, rate: 0.45 },
    ];
    expect(validateCity(broken).length).toBeGreaterThan(0);
  });

  it('rejects a ladder whose final bracket is bounded', () => {
    const broken = structuredClone(sydney);
    const rule = broken.taxRules[0];
    if (rule.kind !== 'brackets') throw new Error('unexpected rule kind');
    rule.brackets = [{ upTo: 18_200, rate: 0 }];
    expect(validateCity(broken)[0].message).toMatch(/upTo: null/);
  });

  it('rejects a city missing a required tax layer', () => {
    const broken = structuredClone(sydney);
    broken.requiredRules = [...broken.requiredRules, 'au-state-income'];
    expect(validateCity(broken)[0].message).toMatch(/entire tax layer is absent/);
  });

  it('rejects a rate outside [0, 1]', () => {
    const broken = structuredClone(sydney);
    const rule = broken.taxRules[0];
    if (rule.kind !== 'brackets') throw new Error('unexpected rule kind');
    rule.brackets[1].rate = 1.6;
    expect(validateCity(broken)[0].message).toMatch(/outside \[0, 1\]/);
  });
});

describe('FX table', () => {
  it('quotes the home currency as the identity', () => {
    expect(rateToHome(SEED_FX, 'AUD')).toBe(1);
  });

  it('converts on the brief’s rates: A$1 = S$0.90 = US$0.71', () => {
    expect(100_000 * rateToHome(SEED_FX, 'SGD')).toBeCloseTo(111_111.11, 2);
    expect(100_000 * rateToHome(SEED_FX, 'USD')).toBeCloseTo(140_845.07, 2);
  });

  it('shifts one currency without touching the others', () => {
    const shifted = shiftFx(SEED_FX, 'USD', 0.2);
    expect(shifted.perHome.USD).toBeCloseTo(0.852, 6);
    expect(shifted.perHome.SGD).toBe(SEED_FX.perHome.SGD);
    // A stronger home currency buys less: the same US surplus is worth less.
    expect(rateToHome(shifted, 'USD')).toBeLessThan(rateToHome(SEED_FX, 'USD'));
  });
});
