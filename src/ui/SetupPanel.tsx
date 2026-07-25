import type { Comparison, Scenario } from '../engine/scenario';
import type { CityData } from '../engine/types';
import { percent } from '../lib/format';
import { Field, Section, Toggle } from './Field';

interface Props {
  scenario: Scenario;
  comparison: Comparison;
  cities: CityData[];
  onChange: (patch: Partial<Scenario>) => void;
}

/**
 * Setup stays minimal on purpose.
 *
 * Living costs are inferred from net income less savings rather than asked
 * for, because people know what they save far better than they know what they
 * spend. The derived figure is shown and can be corrected.
 */
export function SetupPanel({ scenario, comparison, cities, onChange }: Props) {
  const home = comparison.home;
  const homeCurrency = home.city.currency;
  const supportsFiling = cities.some((city) => city.filingStatuses?.length);

  return (
    <div className="space-y-5">
      <Section title="Where you are now">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="home-city" className="font-sans text-[12px] text-muted">
            Home city
          </label>
          <select
            id="home-city"
            value={scenario.homeCityId}
            onChange={(event) => onChange({ homeCityId: event.target.value })}
            className="border-b border-line bg-transparent pb-[2px] text-right font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id} className="bg-plate">
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Base salary"
          prefix={homeCurrency}
          value={scenario.current.base}
          onChange={(base) => onChange({ current: { ...scenario.current, base } })}
        />
        <Field
          label="Equity, annualised"
          prefix={homeCurrency}
          value={scenario.current.equity}
          onChange={(equity) => onChange({ current: { ...scenario.current, equity } })}
        />
        <Field
          label="Annual savings"
          prefix={homeCurrency}
          value={scenario.current.annualSavings}
          onChange={(annualSavings) =>
            onChange({ current: { ...scenario.current, annualSavings } })
          }
        />

        <div className="border-l-2 border-line pl-3">
          <Field
            label="So you spend"
            prefix={homeCurrency}
            value={home.spend}
            onChange={(value) => onChange({ homeSpendOverride: value })}
            hint={`${percent(home.scaleFactor - 1, 0)} ${
              home.scaleFactor >= 1 ? 'above' : 'below'
            } the ${home.city.name} median. Every city is priced at that multiple.`}
          />
          {!home.spendWasInferred && (
            <button
              type="button"
              onClick={() => onChange({ homeSpendOverride: null })}
              className="mt-1 font-mono text-[10.5px] text-muted underline underline-offset-2 hover:text-ink"
            >
              use inferred
            </button>
          )}
        </div>

        {supportsFiling && (
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="filing" className="font-sans text-[12px] text-muted">
              US filing status
            </label>
            <select
              id="filing"
              value={scenario.filingStatus}
              onChange={(event) =>
                onChange({
                  filingStatus: event.target.value as Scenario['filingStatus'],
                })
              }
              className="border-b border-line bg-transparent pb-[2px] text-right font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
            >
              <option value="single" className="bg-plate">
                Single
              </option>
              <option value="married_joint" className="bg-plate">
                Married, filing jointly
              </option>
            </select>
          </div>
        )}
      </Section>

      <Section title="What you are saving for">
        <Field
          label="Target"
          prefix={homeCurrency}
          value={scenario.goal.target}
          step={10_000}
          onChange={(target) => onChange({ goal: { ...scenario.goal, target } })}
        />
        <Field
          label="Already saved"
          prefix={homeCurrency}
          value={scenario.goal.existingCapital}
          step={5_000}
          onChange={(existingCapital) =>
            onChange({ goal: { ...scenario.goal, existingCapital } })
          }
        />
        <Field
          label="By when"
          suffix="years"
          value={scenario.goal.years}
          step={1}
          onChange={(value) =>
            onChange({ goal: { ...scenario.goal, years: Math.max(1, value) } })
          }
        />
        <Field
          label="Target grows"
          suffix="% a year"
          value={Math.round(scenario.goal.goalGrowthRate * 1000) / 10}
          step={0.5}
          onChange={(value) =>
            onChange({ goal: { ...scenario.goal, goalGrowthRate: value / 100 } })
          }
          hint="How fast the thing gets more expensive."
        />

        <Toggle
          label="Count retirement savings"
          checked={scenario.countRetirement}
          onChange={(countRetirement) => onChange({ countRetirement })}
        />
      </Section>
    </div>
  );
}
