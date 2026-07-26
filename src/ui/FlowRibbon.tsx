import { useId } from 'react';
import type { CityOutcome } from '../engine/scenario';
import type { GoalInput } from '../engine/solve';
import { inkFor, money } from '../lib/format';
import { useSpringVector } from './useSpringVector';

/*
 * The flow ribbon.
 *
 * Gross income enters from the left as one continuous ribbon and splits into
 * weighted streams. Each stream's width is its share of gross. The surplus
 * stream crosses the horizon, changes colour as it converts currency, and
 * falls into a home-currency reservoir with the goal marked on it.
 *
 * Hand-built SVG. The geometry is simple and a charting library would fight it.
 */

const VIEW = { w: 1000, h: 360 };
const ENTRY_X = 0;
const HOLD_X = 80;
const FAN_X = 430;
const HORIZON_X = 640;
const RESERVOIR_X = 780;
const RESERVOIR_W = 170;
const RESERVOIR_TOP = 48;
const RESERVOIR_H = 246;
/** The goal line sits below the rim so overshoot is visible above it. */
const GOAL_FRACTION = 0.78;

const STACK_TOP = 44;
const STACK_H = 200;
const GAP = 12;

interface StreamSpec {
  key: string;
  label: string;
  colour: string;
}

/**
 * Costs are drawn in plate greys so the three currency inks stay the only
 * colour on the page. Only the surplus — the thing the user is actually here
 * for — gets the city's ink.
 */
const STREAMS: StreamSpec[] = [
  { key: 'incomeTax', label: 'Income tax', colour: 'var(--stream-1)' },
  { key: 'levies', label: 'Levies', colour: 'var(--stream-2)' },
  { key: 'payrollTax', label: 'Payroll', colour: 'var(--stream-3)' },
  { key: 'health', label: 'Health', colour: 'var(--stream-4)' },
  { key: 'living', label: 'Living cost', colour: 'var(--stream-5)' },
  { key: 'surplus', label: 'Surplus', colour: 'ink' },
];

function band(
  yEntry: number,
  yFan: number,
  height: number,
  endX: number,
): string {
  const c1 = HOLD_X + (FAN_X - HOLD_X) * 0.45;
  const c2 = HOLD_X + (FAN_X - HOLD_X) * 0.55;
  return [
    `M${ENTRY_X} ${yEntry}`,
    `L${HOLD_X} ${yEntry}`,
    `C${c1} ${yEntry} ${c2} ${yFan} ${FAN_X} ${yFan}`,
    `L${endX} ${yFan}`,
    `L${endX} ${yFan + height}`,
    `L${FAN_X} ${yFan + height}`,
    `C${c2} ${yFan + height} ${c1} ${yEntry + height} ${HOLD_X} ${yEntry + height}`,
    `L${ENTRY_X} ${yEntry + height}`,
    'Z',
  ].join(' ');
}

export interface FlowRibbonProps {
  outcome: CityOutcome;
  goal: GoalInput & { years: number };
  homeCurrency: string;
  countRetirement: boolean;
}

export function FlowRibbon({
  outcome,
  goal,
  homeCurrency,
  countRetirement,
}: FlowRibbonProps) {
  const gradientId = useId();
  const { result, city } = outcome;
  const gross = Math.max(result.grossComp, 1);

  const amounts: Record<string, number> = {
    incomeTax: result.incomeTax,
    levies: result.levies,
    payrollTax: result.payrollTax,
    health: result.healthCost,
    living: result.livingCost,
    surplus: Math.max(0, result.surplusLocal),
  };

  const grownTarget =
    goal.target * Math.pow(1 + goal.goalGrowthRate, goal.years);
  const accumulated =
    goal.existingCapital +
    Math.max(0, result[countRetirement ? 'totalValueHome' : 'surplusHome']) *
      goal.years;
  const fill = grownTarget > 0 ? accumulated / grownTarget : 0;
  const existingFill = grownTarget > 0 ? goal.existingCapital / grownTarget : 0;

  // One spring vector drives everything: six stream shares, the retirement
  // share, the reservoir fill, and the already-banked portion of it.
  const targets = [
    ...STREAMS.map((s) => amounts[s.key] / gross),
    result.employerRetirement / gross,
    Math.min(fill, 1.25),
    Math.min(existingFill, 1.25),
  ];
  const springs = useSpringVector(targets);
  const shares = springs.slice(0, STREAMS.length);
  const retirementShare = springs[STREAMS.length];
  const fillNow = springs[STREAMS.length + 1];
  const existingNow = springs[STREAMS.length + 2];

  // Entry: contiguous stack. Fan: same order, spaced out and re-centred.
  const heights = shares.map((share) => Math.max(0, share) * STACK_H);
  const totalHeight = heights.reduce((t, h) => t + h, 0);
  const visible = heights.filter((h) => h > 0.5).length;
  const fanHeight = totalHeight + GAP * Math.max(0, visible - 1);
  const fanTop = STACK_TOP + (STACK_H - fanHeight) / 2;

  let entryCursor = STACK_TOP + (STACK_H - totalHeight) / 2;
  let fanCursor = fanTop;
  const geometry = STREAMS.map((spec, index) => {
    const height = heights[index];
    const yEntry = entryCursor;
    const yFan = fanCursor;
    entryCursor += height;
    fanCursor += height + (height > 0.5 ? GAP : 0);
    return { spec, height, yEntry, yFan, amount: amounts[spec.key] };
  });

  const surplus = geometry[geometry.length - 1];
  const cityInk = inkFor(city.currency);
  const homeInk = inkFor(homeCurrency);

  const retirementHeight = Math.max(0, retirementShare) * STACK_H;
  const retirementY = STACK_TOP + STACK_H + 22;

  const goalY = RESERVOIR_TOP + RESERVOIR_H * (1 - GOAL_FRACTION);
  const fillHeight = Math.min(
    RESERVOIR_H,
    Math.max(0, fillNow) * GOAL_FRACTION * RESERVOIR_H,
  );
  const existingHeight = Math.min(
    fillHeight,
    Math.max(0, existingNow) * GOAL_FRACTION * RESERVOIR_H,
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="w-full"
      role="img"
      aria-label={
        `Gross ${money(result.grossComp, city.currency)} in ${city.name} splits into ` +
        `${money(result.totalTax, city.currency)} of tax, ` +
        `${money(result.livingCost + result.healthCost, city.currency)} of living cost, and ` +
        `${money(result.surplusLocal, city.currency)} of surplus, worth ` +
        `${money(result.surplusHome, homeCurrency)} at home.`
      }
    >
      <defs>
        {/* The surplus converts as it crosses the horizon, so does its ink. */}
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={FAN_X}
          x2={RESERVOIR_X}
        >
          <stop offset="0" stopColor={cityInk} />
          <stop offset="0.5" stopColor={cityInk} />
          <stop offset="0.72" stopColor={homeInk} />
          <stop offset="1" stopColor={homeInk} />
        </linearGradient>
      </defs>

      {/* Horizon */}
      <line
        x1={HORIZON_X}
        y1={26}
        x2={HORIZON_X}
        y2={VIEW.h - 26}
        stroke="var(--color-line)"
        strokeWidth={1}
        strokeDasharray="2 5"
      />
      <text
        x={HORIZON_X + 8}
        y={VIEW.h - 14}
        className="font-mono tnum"
        fontSize={10}
        fill="var(--color-muted)"
      >
        {city.currency === homeCurrency
          ? 'home currency'
          : `converted at ${outcome.fxToHome.toFixed(4)}`}
      </text>

      <text
        x={ENTRY_X}
        y={STACK_TOP - 14}
        className="font-mono tnum"
        fontSize={11}
        fill="var(--color-muted)"
      >
        {`gross ${money(result.grossComp, city.currency)}`}
      </text>

      {geometry.map(({ spec, height, yEntry, yFan, amount }) => {
        const isSurplus = spec.key === 'surplus';
        if (height < 0.5) return null;
        return (
          <g key={spec.key}>
            <path
              d={band(yEntry, yFan, height, isSurplus ? RESERVOIR_X : FAN_X + 4)}
              fill={isSurplus ? `url(#${gradientId})` : spec.colour}
              opacity={isSurplus ? 1 : 0.9}
            />
            {!isSurplus && (
              <text
                x={FAN_X + 16}
                y={yFan + height / 2 + 3.5}
                className="font-mono tnum"
                fontSize={10.5}
                fill="var(--color-muted)"
              >
                {`${spec.label}  ${money(amount, city.currency)}`}
              </text>
            )}
          </g>
        );
      })}

      {/* Surplus label rides above its own stream, in the city's ink. */}
      {surplus.height >= 0.5 && (
        <text
          x={FAN_X + 16}
          y={surplus.yFan - 8}
          className="font-mono tnum"
          fontSize={11}
          fill={cityInk}
        >
          {`surplus ${money(surplus.amount, city.currency)}`}
        </text>
      )}

      {/* Superannuation and the like: paid on top of salary, so drawn outside
          the ribbon rather than inside it. */}
      {retirementHeight > 0.5 && (
        <g opacity={countRetirement ? 1 : 0.45}>
          <rect
            x={ENTRY_X}
            y={retirementY}
            width={FAN_X + 4}
            height={retirementHeight}
            fill={cityInk}
            opacity={0.35}
          />
          <text
            x={FAN_X + 16}
            y={retirementY + retirementHeight / 2 + 3.5}
            className="font-mono tnum"
            fontSize={10.5}
            fill="var(--color-muted)"
          >
            {`Retirement  ${money(result.retirementNetOfTax, city.currency)}` +
              (countRetirement ? '' : '  · not counted')}
          </text>
        </g>
      )}

      {/* Reservoir */}
      <g>
        <rect
          x={RESERVOIR_X}
          y={RESERVOIR_TOP}
          width={RESERVOIR_W}
          height={RESERVOIR_H}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={1}
        />
        <rect
          x={RESERVOIR_X}
          y={RESERVOIR_TOP + RESERVOIR_H - fillHeight}
          width={RESERVOIR_W}
          height={fillHeight}
          fill={homeInk}
          opacity={0.55}
        />
        <rect
          x={RESERVOIR_X}
          y={RESERVOIR_TOP + RESERVOIR_H - existingHeight}
          width={RESERVOIR_W}
          height={existingHeight}
          fill={homeInk}
          opacity={0.35}
        />
        {/* Surface line: the reservoir reads as filling rather than as a bar. */}
        {fillHeight > 0.5 && (
          <line
            x1={RESERVOIR_X}
            y1={RESERVOIR_TOP + RESERVOIR_H - fillHeight}
            x2={RESERVOIR_X + RESERVOIR_W}
            y2={RESERVOIR_TOP + RESERVOIR_H - fillHeight}
            stroke={homeInk}
            strokeWidth={1.5}
          />
        )}
        <line
          x1={RESERVOIR_X - 10}
          y1={goalY}
          x2={RESERVOIR_X + RESERVOIR_W + 10}
          y2={goalY}
          stroke="var(--color-ink)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={RESERVOIR_X + RESERVOIR_W + 10}
          y={goalY - 8}
          textAnchor="end"
          className="font-mono tnum"
          fontSize={10.5}
          fill="var(--color-ink)"
        >
          {`goal ${money(grownTarget, homeCurrency)}`}
        </text>
        <text
          x={RESERVOIR_X}
          y={RESERVOIR_TOP + RESERVOIR_H + 18}
          className="font-mono tnum"
          fontSize={10.5}
          fill="var(--color-muted)"
        >
          {`after ${goal.years} years: ${money(accumulated, homeCurrency)}`}
        </text>
      </g>
    </svg>
  );
}
