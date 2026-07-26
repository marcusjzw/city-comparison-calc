import { useMemo } from 'react';
import type { CityOutcome } from '../engine/scenario';
import { categorySensitivity } from '../engine/solve';
import type { Confidence, FilingStatus } from '../engine/types';
import { money, percent, symbolFor } from '../lib/format';

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  institutional: 'institutional',
  derived: 'derived',
  estimated: 'estimated',
};

interface Props {
  outcome: CityOutcome;
  filingStatus: FilingStatus;
  preTaxDeductions: number;
  homeCurrency: string;
  ink: string;
  onSet: (categoryId: string, annual: number) => void;
  onReset: (categoryId?: string) => void;
  overrides: Record<string, number>;
}

/**
 * The cost basket drill-down. Sliders and numeric inputs are bound to the same
 * state, so whichever the user reaches for, the other follows.
 *
 * The sensitivity strip ranks categories by how much a 10% change in each
 * moves the answer. Housing dominates everywhere, which is the point: it tells
 * the user exactly which number to go and research properly.
 */
export function BasketEditor({
  outcome,
  filingStatus,
  preTaxDeductions,
  homeCurrency,
  ink,
  onSet,
  onReset,
  overrides,
}: Props) {
  const { city, basket, result } = outcome;
  const currency = city.currency;

  const sensitivity = useMemo(
    () =>
      categorySensitivity(
        {
          city,
          filingStatus,
          preTaxDeductions,
          healthCost: result.healthCost,
          fxToHome: outcome.fxToHome,
        },
        result.grossComp,
        basket.map((line) => ({
          id: line.id,
          label: line.label,
          annual: line.annual,
        })),
      ),
    [city, filingStatus, preTaxDeductions, result, basket, outcome.fxToHome],
  );

  const topImpact = sensitivity[0]?.impact ?? 1;
  const edited = Object.keys(overrides).length > 0;
  /* These sliders price a life in {city}, so they are denominated in the city's
     own currency — not the display currency in the masthead. The two differ for
     most sessions, and an unlabelled number here is a silent wrong answer. */
  const mixed = currency !== homeCurrency;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <p className="eyebrow">
          What a year costs in {city.name}, in {currency}
        </p>
        {edited && (
          <button
            type="button"
            onClick={() => onReset()}
            className="shrink-0 font-mono text-[11px] text-muted underline underline-offset-2 hover:text-ink"
          >
            reset all
          </button>
        )}
      </div>

      <div className="space-y-3">
        {basket.map((line) => {
          const ceiling = Math.max(line.median * 2.5, line.annual * 1.4, 1200);
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
                    value={Math.round(line.annual)}
                    step={100}
                    min={0}
                    aria-label={`${line.label} annual cost, ${currency}`}
                    onChange={(event) => onSet(line.id, Number(event.target.value))}
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
                  max={Math.round(ceiling)}
                  step={100}
                  value={Math.round(line.annual)}
                  onChange={(event) => onSet(line.id, Number(event.target.value))}
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
                  {percent(Math.abs(drift), 0)} vs median {money(line.median, currency)}
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
          Worth of a 10% change{mixed && `, back in ${homeCurrency}`}
        </h4>
        <div className="mt-2 space-y-2">
          {sensitivity.map((entry) => (
            <div key={entry.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-sans text-[11px] text-muted">
                  {entry.label}
                </span>
                <span className="tnum shrink-0 font-mono text-[11px] text-ink">
                  {money(entry.impact, homeCurrency)}
                </span>
              </div>
              <div className="mt-[3px] h-[5px] bg-line/60">
                <div
                  className="h-full"
                  style={{
                    width: `${topImpact > 0 ? (entry.impact / topImpact) * 100 : 0}%`,
                    background: ink,
                    opacity: 0.75,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted/70">
          on annual surplus
        </p>
      </div>
    </div>
  );
}
