import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { SEED_FX } from '../data/fx';
import { medianAnnual } from './basket';
import { compare, type Mode, type Scenario } from './scenario';

const BASE_SCENARIO: Scenario = {
  homeCityId: 'sydney',
  displayCurrency: 'AUD',
  current: { comp: 311_500 },
  homeSpendOverride: null,
  filingStatus: 'married_joint',
  preTaxDeductions: 0,
  goal: {
    target: 400_000,
    goalGrowthRate: 0.05,
    years: 4,
  },
  mode: 'savings',
  countRetirement: false,
  basketOverrides: {},
  healthOverrides: {},
  fxShifts: {},
};

const run = (overrides: Partial<Scenario> = {}) =>
  compare({ ...BASE_SCENARIO, ...overrides }, CITIES, SEED_FX);

const outcome = (mode: Mode, id: string) =>
  run({ mode }).outcomes.find((o) => o.city.id === id)!;

describe('home snapshot', () => {
  it('infers living cost from the home city median, not an asked-for savings figure', () => {
    const { home } = run();
    const sydney = CITIES.find((c) => c.id === 'sydney')!;
    expect(home.spendWasInferred).toBe(true);
    expect(home.spend).toBeCloseTo(medianAnnual(sydney), 6);
  });

  it('takes a correction over the inference', () => {
    const { home } = run({ homeSpendOverride: 120_000 });
    expect(home.spendWasInferred).toBe(false);
    expect(home.spend).toBe(120_000);
  });
});

describe('savings parity', () => {
  it('asks the home city for roughly the comp the user already has', () => {
    const sydney = outcome('savings', 'sydney');
    expect(sydney.requiredGross).toBeCloseTo(311_500, -2.5);
  });

  it('produces the same home-currency surplus in every city', () => {
    const { outcomes, home } = run({ mode: 'savings' });
    for (const o of outcomes) {
      expect(o.result.surplusHome).toBeCloseTo(home.surplusHome, 3);
    }
  });
});

describe('lifestyle parity', () => {
  it('prices the same standard of living, not the same savings', () => {
    const { outcomes } = run({ mode: 'lifestyle' });
    const sf = outcomes.find((o) => o.city.id === 'san-francisco')!;
    const sydney = outcomes.find((o) => o.city.id === 'sydney')!;
    // San Francisco costs more to live in, so it needs more gross...
    expect(sf.livingCost * sf.fxToHome).toBeGreaterThan(sydney.livingCost);
    // ...but the surplus it throws off is a local buffer, not a savings target.
    expect(sf.result.surplusHome).not.toBeCloseTo(sydney.result.surplusHome, 0);
  });

  it('leaves the home city on its current comp, since nothing has changed', () => {
    expect(outcome('lifestyle', 'sydney').requiredGross).toBeCloseTo(311_500, -2.5);
  });
});

describe('goal mode', () => {
  it('solves for the surplus that lands the target on the date', () => {
    const { outcomes } = run({ mode: 'goal' });
    for (const o of outcomes) {
      expect(o.years).toBeCloseTo(4, 1);
    }
  });

  it('needs a bigger surplus as the target inflates faster', () => {
    const slow = run({ mode: 'goal', goal: { ...BASE_SCENARIO.goal, goalGrowthRate: 0 } });
    const fast = run({ mode: 'goal', goal: { ...BASE_SCENARIO.goal, goalGrowthRate: 0.1 } });
    for (const [index, o] of fast.outcomes.entries()) {
      expect(o.requiredGrossHome).toBeGreaterThan(slow.outcomes[index].requiredGrossHome);
    }
  });

  it('asks for less gross once retirement counts toward the goal', () => {
    const without = outcome('goal', 'sydney').requiredGross;
    const with_ = run({ mode: 'goal', countRetirement: true }).outcomes.find(
      (o) => o.city.id === 'sydney',
    )!.requiredGross;
    expect(with_).toBeLessThan(without);
  });
});

describe('ranking', () => {
  it('orders home city first, then the rest A-Z, regardless of ask', () => {
    for (const mode of ['lifestyle', 'savings', 'goal'] as Mode[]) {
      const { outcomes } = run({ mode });
      expect(outcomes[0].isHome).toBe(true);
      const rest = outcomes.slice(1).map((o) => o.city.name);
      expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('order is stable across modes, unlike the requiredGrossHome ranking', () => {
    for (const mode of ['lifestyle', 'savings', 'goal'] as Mode[]) {
      const { outcomes } = run({ mode });
      expect(outcomes.map((o) => o.city.id)).toEqual(
        run({ mode: 'lifestyle' }).outcomes.map((o) => o.city.id),
      );
    }
  });

  it('moves with the exchange rate, which is the whole product', () => {
    const strongAud = run({ mode: 'goal', fxShifts: { USD: 0.25, SGD: 0.25 } });
    const weakAud = run({ mode: 'goal', fxShifts: { USD: -0.25, SGD: -0.25 } });

    for (const city of ['singapore', 'san-francisco']) {
      const strong = strongAud.outcomes.find((o) => o.city.id === city)!;
      const weak = weakAud.outcomes.find((o) => o.city.id === city)!;
      // A strong home currency means each unit of foreign surplus converts to
      // less, so the local salary you must negotiate goes up.
      expect(strong.requiredGross).toBeGreaterThan(weak.requiredGross);
      // Expressed back in home currency the ask shrinks, because the local
      // cost base — which the salary also has to cover — got cheaper too.
      expect(strong.requiredGrossHome).toBeLessThan(weak.requiredGrossHome);
    }
    // The home city is untouched by any of it.
    const home = (c: ReturnType<typeof run>) =>
      c.outcomes.find((o) => o.city.id === 'sydney')!.requiredGross;
    expect(home(strongAud)).toBeCloseTo(home(weakAud), 6);
  });
});

describe('unreachable targets', () => {
  it('reports Infinity rather than inventing a number', () => {
    const { outcomes } = run({
      mode: 'goal',
      goal: { target: 50_000_000, goalGrowthRate: 0.05, years: 2 },
    });
    expect(outcomes.every((o) => o.requiredGross === Infinity)).toBe(true);
  });
});

describe('filing status', () => {
  it('is ignored by cities that do not offer it', () => {
    const single = run({ filingStatus: 'single' });
    const joint = run({ filingStatus: 'married_joint' });
    const grossFor = (c: ReturnType<typeof run>, id: string) =>
      c.outcomes.find((o) => o.city.id === id)!.requiredGross;

    expect(grossFor(single, 'singapore')).toBeCloseTo(grossFor(joint, 'singapore'), 6);
    expect(grossFor(single, 'san-francisco')).toBeGreaterThan(
      grossFor(joint, 'san-francisco'),
    );
  });
});
