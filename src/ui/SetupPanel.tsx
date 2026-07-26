import type { Comparison, Mode, Scenario } from '../engine/scenario';
import type { CityData } from '../engine/types';
import { money, percent } from '../lib/format';
import { Field, Section, Toggle } from './Field';

interface Props {
  scenario: Scenario;
  comparison: Comparison;
  cities: CityData[];
  mode: Mode;
  onChange: (patch: Partial<Scenario>) => void;
}

/**
 * Setup stays minimal on purpose.
 *
 * Salary is the only thing asked for. Living cost defaults to the home
 * city's own median — a typical spender — rather than a savings figure
 * nobody was asked to produce; what's left over is shown as the derived
 * result, not collected as an input. The spend figure can still be
 * corrected if the median guess is off.
 *
 * Two currencies are in play here and the distinction is load-bearing. What
 * you earn and spend today is in your home city's currency, because that is
 * what its tax code and its rent are denominated in. What you are saving for
 * is in the display currency, because that is the unit every city is being
 * compared in. Each field carries its own prefix so the two never blur.
 */
export function SetupPanel({ scenario, comparison, cities, mode, onChange }: Props) {
  const home = comparison.home;
  const localCurrency = home.city.currency;
  const displayCurrency = scenario.displayCurrency;
  const mixedCurrencies = localCurrency !== displayCurrency;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
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

        {mixedCurrencies && (
          <p className="font-sans text-[10.5px] leading-relaxed text-muted/80">
            Enter these in {localCurrency}. Comparisons come back in{' '}
            {displayCurrency}.
          </p>
        )}

        <Field
          label="Total pay a year"
          prefix={localCurrency}
          value={scenario.current.comp}
          onChange={(comp) => onChange({ current: { ...scenario.current, comp } })}
          hint="Salary, bonus and any equity, added together."
        />

        <div className="border-l-2 border-line pl-3">
          <Field
            label="So you spend"
            prefix={localCurrency}
            value={home.spend}
            onChange={(value) => onChange({ homeSpendOverride: value })}
            hint={`${percent(Math.abs(home.scaleFactor - 1), 0)} ${
              home.scaleFactor >= 1 ? 'above' : 'below'
            } the ${home.city.name} median. Edit if it's wrong.`}
          />
          {!home.spendWasInferred && (
            <button
              type="button"
              onClick={() => onChange({ homeSpendOverride: null })}
              className="mt-1 font-mono text-[10.5px] text-muted underline underline-offset-2 hover:text-ink"
            >
              back to estimate
            </button>
          )}
        </div>

        {/* Savings is the output of pay minus spend, not a separate question.
            Showing it here is what makes "save the same" mean something
            concrete before the reader ever picks that mode. */}
        <p className="font-sans text-[12px] leading-relaxed text-muted">
          That leaves{' '}
          <span className="tnum font-mono text-ink">
            {money(home.surplusHome, displayCurrency)}
          </span>{' '}
          a year to save.
        </p>

        {/* US filing status used to live here, where it read as a question
            everyone had to answer. It only changes one city's tax, so it now
            sits on that city's card. */}
      </div>

      {/* The goal only exists in Goal mode — the other two modes answer a
          different question, so surfacing "what you're saving for" there is
          just noise. Lead with the one number that matters; the refinements
          live behind an expander. */}
      {mode === 'goal' && (
        <Section title="What you are saving for">
          <Field
            label="Savings target"
            prefix={displayCurrency}
            value={scenario.goal.target}
            step={10_000}
            onChange={(target) => onChange({ goal: { ...scenario.goal, target } })}
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

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-faint transition-colors hover:text-ink">
              <span className="font-mono text-[11px] transition-transform group-open:rotate-90">
                ›
              </span>
              <span className="font-mono text-[10.5px] tracking-wide">Fine-tune</span>
            </summary>
            <div className="mt-3 space-y-3 border-l border-line pl-3">
              <Field
                label="Target grows"
                suffix="% a year"
                value={Math.round(scenario.goal.goalGrowthRate * 1000) / 10}
                step={0.5}
                onChange={(value) =>
                  onChange({ goal: { ...scenario.goal, goalGrowthRate: value / 100 } })
                }
                hint="How fast the thing you're saving for gets pricier."
              />
              <Toggle
                label="Count retirement toward it"
                checked={scenario.countRetirement}
                onChange={(countRetirement) => onChange({ countRetirement })}
                hint="Super and 401(k) are real money — but not deposit money."
              />
            </div>
          </details>
        </Section>
      )}
    </div>
  );
}
