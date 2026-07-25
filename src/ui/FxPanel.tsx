import type { FxHistory } from '../data/fx';
import type { FxTable } from '../engine/fx';
import type { Comparison, Scenario } from '../engine/scenario';
import { inkFor, money, shortDate } from '../lib/format';

interface Props {
  fx: FxTable;
  history: Record<string, FxHistory>;
  live: boolean;
  comparison: Comparison;
  scenario: Scenario;
  onShift: (currency: string, shift: number) => void;
}

/**
 * For a repatriating saver the FX assumption is as consequential as the tax
 * rate, and nobody else exposes it. So it gets a dedicated, always-visible
 * panel rather than a setting buried somewhere.
 */
export function FxPanel({
  fx,
  history,
  live,
  comparison,
  scenario,
  onShift,
}: Props) {
  const homeCurrency = fx.homeCurrency;
  const foreign = comparison.outcomes.filter(
    (outcome) => outcome.city.currency !== homeCurrency,
  );

  return (
    <div>
      <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
        Exchange rates
      </h2>
      <p className="mt-2 font-mono text-[10.5px] text-muted">
        {fx.source} · {shortDate(fx.asOf)}
        {!live && ' · seed values, live quote pending'}
      </p>

      <div className="mt-4 space-y-6">
        {foreign.map((outcome) => {
          const { city } = outcome;
          const ink = inkFor(city.currency);
          const baseRate = fx.perHome[city.currency];
          const shift = scenario.fxShifts[city.currency] ?? 0;
          const rate = baseRate * (1 + shift);

          // Hold the local package fixed and revalue it. That is the question
          // a saver is actually asking: what is my surplus worth if the rate
          // moves, not what salary would I renegotiate.
          const yearsHeld = scenario.goal.years;
          const deltaHome =
            outcome.result.surplusLocal * yearsHeld * (1 / rate - 1 / baseRate);

          const series = history[city.currency];

          return (
            <div key={city.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[12px] text-ink">
                  {homeCurrency} 1 ={' '}
                  <span className="tnum font-mono" style={{ color: ink }}>
                    {rate.toFixed(4)}
                  </span>{' '}
                  {city.currency}
                </span>
                {shift !== 0 && (
                  <button
                    type="button"
                    onClick={() => onShift(city.currency, 0)}
                    className="font-mono text-[10.5px] text-muted underline underline-offset-2 hover:text-ink"
                  >
                    reset
                  </button>
                )}
              </div>

              <input
                type="range"
                min={-20}
                max={20}
                step={0.5}
                value={Math.round(shift * 1000) / 10}
                aria-label={`${city.currency} rate shift, percent`}
                onChange={(event) =>
                  onShift(city.currency, Number(event.target.value) / 100)
                }
                style={{ ['--stream' as string]: ink }}
                className="mt-2 h-1 w-full cursor-pointer appearance-none rounded bg-line"
              />

              {shift !== 0 && (
                <p className="mt-2 max-w-prose font-sans text-[11.5px] leading-relaxed text-ink">
                  At {rate.toFixed(2)} instead of {baseRate.toFixed(2)}, {yearsHeld}{' '}
                  {yearsHeld === 1 ? 'year' : 'years'} in {city.name} is worth{' '}
                  <span className="tnum font-mono" style={{ color: ink }}>
                    {money(Math.abs(deltaHome), homeCurrency)}
                  </span>{' '}
                  {deltaHome < 0 ? 'less' : 'more'}.
                </p>
              )}

              {series && (
                <div className="mt-2">
                  <div className="relative h-[6px] bg-line/60">
                    <span
                      className="absolute top-[-3px] h-[12px] w-px"
                      style={{
                        left: `${clamp((rate - series.min) / (series.max - series.min))}%`,
                        background: ink,
                      }}
                    />
                  </div>
                  <p className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                    <span className="tnum">{series.min.toFixed(2)}</span>
                    <span>ten-year range</span>
                    <span className="tnum">{series.max.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clamp(fraction: number): number {
  if (!Number.isFinite(fraction)) return 50;
  return Math.min(100, Math.max(0, fraction * 100));
}
