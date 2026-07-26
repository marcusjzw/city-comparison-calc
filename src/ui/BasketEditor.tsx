import { useMemo, useState } from 'react';
import type { CityOutcome } from '../engine/scenario';
import type { Confidence } from '../engine/types';
import { money, percent, symbolFor } from '../lib/format';

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  institutional: 'institutional',
  derived: 'derived',
  estimated: 'estimated',
};

interface Props {
  outcome: CityOutcome;
  ink: string;
  onSet: (categoryId: string, annual: number) => void;
  onReset: (categoryId?: string) => void;
  overrides: Record<string, number>;
}

/**
 * The cost basket drill-down. Sliders and numeric inputs are bound to the same
 * state, so whichever the user reaches for, the other follows.
 */
export function BasketEditor({
  outcome,
  ink,
  onSet,
  onReset,
  overrides,
}: Props) {
  const { city, basket, result } = outcome;
  /* These sliders price a life in {city}, so they're denominated in the
     city's own currency, not the display currency in the masthead. */
  const currency = city.currency;

  /* Every stored figure is annual, in city currency. Monthly is just a
     display/entry convenience: divide by 12 to show, multiply by 12 before
     it hits onSet, so the rest of the app never has to know this exists. */
  const [entryMode, setEntryMode] = useState<'annual' | 'monthly'>('annual');
  const toDisplay = (annual: number) => (entryMode === 'monthly' ? annual / 12 : annual);
  const toAnnual = (value: number) => (entryMode === 'monthly' ? value * 12 : value);

  const distribution = useMemo(
    () =>
      [...basket]
        .sort((a, b) => b.annual - a.annual)
        .map((line) => ({
          id: line.id,
          label: line.label,
          annual: line.annual,
          share: outcome.livingCost > 0 ? line.annual / outcome.livingCost : 0,
        })),
    [basket, outcome.livingCost],
  );

  const edited = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <p className="eyebrow">
          What a {entryMode === 'monthly' ? 'month' : 'year'} costs
        </p>
        <div className="flex shrink-0 items-baseline gap-3">
          <div className="flex font-mono text-[11px] text-muted">
            {(['monthly', 'annual'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEntryMode(mode)}
                aria-pressed={entryMode === mode}
                className={`px-1 underline-offset-2 ${
                  entryMode === mode ? 'text-ink underline' : 'hover:text-ink'
                }`}
              >
                {mode === 'monthly' ? '/mo' : '/yr'}
              </button>
            ))}
          </div>
          {edited && (
            <button
              type="button"
              onClick={() => onReset()}
              className="font-mono text-[11px] text-muted underline underline-offset-2 hover:text-ink"
            >
              reset all
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {basket.map((line) => {
          const ceiling = Math.max(line.median * 2.5, line.annual * 1.4, 1200);
          const displayCeiling = toDisplay(ceiling);
          const displayValue = toDisplay(line.annual);
          const displayStep = entryMode === 'monthly' ? 10 : 100;
          const overridden = overrides[line.id] !== undefined;
          const drift = line.vsMedian - 1;
          return (
            <div key={line.id}>
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`basket-${city.id}-${line.id}`}
                  className="font-sans text-[12px] leading-tight text-ink"
                >
                  {line.label}{' '}
                  <span className="font-mono text-[10px] whitespace-nowrap text-muted/70">
                    {CONFIDENCE_LABEL[line.confidence]}
                  </span>
                </label>
                <div className="flex shrink-0 items-baseline gap-1">
                  <span aria-hidden className="font-mono text-[11px] text-faint">
                    {symbolFor(currency)}
                  </span>
                  <input
                    type="number"
                    value={Math.round(displayValue)}
                    step={displayStep}
                    min={0}
                    aria-label={`${line.label} ${entryMode} cost, ${currency}`}
                    onChange={(event) => onSet(line.id, toAnnual(Number(event.target.value)))}
                    className="tnum w-[70px] border-b border-line bg-transparent pb-[2px] text-right font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onReset(line.id)}
                    aria-label={`Reset ${line.label} to median`}
                    className={`font-mono text-[11px] ${
                      overridden ? 'text-muted hover:text-ink' : 'invisible'
                    }`}
                  >
                    ↺
                  </button>
                </div>
              </div>

              <div className="relative pt-[3px] pb-[6px]">
                <input
                  id={`basket-${city.id}-${line.id}`}
                  type="range"
                  min={0}
                  max={Math.round(displayCeiling)}
                  step={displayStep}
                  value={Math.round(displayValue)}
                  onChange={(event) => onSet(line.id, toAnnual(Number(event.target.value)))}
                  style={{ ['--stream' as string]: ink }}
                  className="h-1 w-full cursor-pointer appearance-none rounded bg-line"
                />
                {/* Median marker: where typical sits on this scale. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0 h-[9px] w-px bg-muted/70"
                  style={{ left: `${Math.min(100, (line.median / ceiling) * 100)}%` }}
                />
              </div>

              {/* Before any edit every line sits at the same multiple of its
                  median, and the setup panel already says so — repeating it ten
                  times is noise. It earns its place once a line moves. */}
              {overridden && Math.abs(drift) > 0.02 && (
                <p
                  className="tnum font-mono text-[10px]"
                  style={{ color: drift > 0 ? ink : 'var(--color-muted)' }}
                >
                  {drift > 0 ? '+' : '−'}
                  {percent(Math.abs(drift), 0)} vs median {money(toDisplay(line.median), currency)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-sans text-[12px] text-muted">
          Total, plus {money(result.healthCost, currency)} health
        </span>
        <span className="tnum font-mono text-[13px] text-ink">
          {money(outcome.livingCost + result.healthCost, currency)}
        </span>
      </div>

      <div>
        <h4 className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          Where it goes
        </h4>
        <div className="mt-2 space-y-2">
          {distribution.map((entry) => (
            <div key={entry.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-sans text-[11px] text-muted">
                  {entry.label}
                </span>
                <span className="tnum shrink-0 font-mono text-[11px] text-ink">
                  {percent(entry.share, 0)}
                </span>
              </div>
              <div className="mt-[3px] h-[5px] bg-line/60">
                <div
                  className="h-full"
                  style={{
                    width: `${entry.share * 100}%`,
                    background: ink,
                    opacity: 0.75,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
