import type { GoalInput } from '../engine/solve';
import { money, years as formatYears } from '../lib/format';

/**
 * The goal drill-down: accumulated capital against a target that is itself
 * getting more expensive, with the crossover marked. When the two lines never
 * meet, they visibly never meet.
 */
export function GoalCurve({
  goal,
  annualSurplus,
  crossover,
  homeCurrency,
  ink,
}: {
  goal: GoalInput;
  annualSurplus: number;
  crossover: number;
  homeCurrency: string;
  ink: string;
}) {
  const span = Math.min(
    20,
    Math.max(6, Number.isFinite(crossover) ? Math.ceil(crossover) + 2 : 12),
  );
  const W = 460;
  const H = 150;
  const PAD = { l: 8, r: 8, t: 14, b: 20 };

  const capitalAt = (year: number) => annualSurplus * year;
  const targetAt = (year: number) =>
    goal.target * Math.pow(1 + goal.goalGrowthRate, year);

  const peak = Math.max(capitalAt(span), targetAt(span), 1);
  const x = (year: number) => PAD.l + (year / span) * (W - PAD.l - PAD.r);
  const y = (value: number) =>
    H - PAD.b - (value / peak) * (H - PAD.t - PAD.b);

  const steps = 60;
  const line = (fn: (year: number) => number) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const year = (i / steps) * span;
      return `${i === 0 ? 'M' : 'L'}${x(year).toFixed(1)} ${y(fn(year)).toFixed(1)}`;
    }).join(' ');

  const meets = Number.isFinite(crossover) && crossover <= span;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={
        `Capital reaches the goal in ${formatYears(crossover)}`
      }>
        <line
          x1={PAD.l}
          y1={H - PAD.b}
          x2={W - PAD.r}
          y2={H - PAD.b}
          stroke="var(--color-line)"
        />
        <path d={line(targetAt)} fill="none" stroke="var(--color-muted)" strokeWidth={1.25} strokeDasharray="4 3" />
        <path d={line(capitalAt)} fill="none" stroke={ink} strokeWidth={2} />

        {meets && (
          <g>
            <circle cx={x(crossover)} cy={y(capitalAt(crossover))} r={4} fill={ink} />
            <line
              x1={x(crossover)}
              y1={y(capitalAt(crossover))}
              x2={x(crossover)}
              y2={H - PAD.b}
              stroke={ink}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          </g>
        )}

        {[0, span / 2, span].map((year) => (
          <text
            key={year}
            x={x(year)}
            y={H - 6}
            textAnchor={year === 0 ? 'start' : year === span ? 'end' : 'middle'}
            className="font-mono tnum"
            fontSize={9.5}
            fill="var(--color-muted)"
          >
            {`${Math.round(year)}y`}
          </text>
        ))}
      </svg>

      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
        <dt className="text-muted">Target today</dt>
        <dd className="tnum text-right text-ink">{money(goal.target, homeCurrency)}</dd>
        <dt className="text-muted">Annual surplus</dt>
        <dd className="tnum text-right text-ink">
          {money(annualSurplus, homeCurrency)}
        </dd>
        <dt className="text-muted">Crossover</dt>
        <dd className="tnum text-right" style={{ color: ink }}>
          {formatYears(crossover)}
        </dd>
      </dl>
    </div>
  );
}
