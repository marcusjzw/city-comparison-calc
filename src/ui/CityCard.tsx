import { AnimatePresence, motion } from 'motion/react';
import type { CityOutcome, Scenario } from '../engine/scenario';
import { inkFor, money, moneyCompact, percent, shortDate } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { BasketEditor } from './BasketEditor';
import { BracketLadder } from './BracketLadder';
import { GoalCurve } from './GoalCurve';

type Panel = 'tax' | 'living' | 'surplus' | 'goal';

const PANEL_LABEL: Record<Panel, string> = {
  tax: 'Tax',
  living: 'Living',
  surplus: 'Surplus',
  goal: 'Goal',
};

interface Props {
  outcome: CityOutcome;
  scenario: Scenario;
  homeCurrency: string;
  leader: boolean;
  /**
   * How much more this city has to pay you than the cheapest ask does, and
   * whose ask that is. Null on the leader itself.
   *
   * This replaced a 1st/2nd/3rd ordinal. In a parity mode "2nd" reads like a
   * league table with no stated event — the cities are not competing, one of
   * them simply has to pay you more to stand still. Naming the gap says what
   * the ordinal was standing in for.
   */
  behindLeader: { name: string; extraHome: number } | null;
  focused: boolean;
  openPanel: Panel | null;
  onFocus: () => void;
  onTogglePanel: (panel: Panel) => void;
  onSetBasket: (cityId: string, categoryId: string, annual: number) => void;
  onResetBasket: (cityId: string, categoryId?: string) => void;
  onFilingStatus: (status: Scenario['filingStatus']) => void;
}

export function CityCard({
  outcome,
  scenario,
  homeCurrency,
  leader,
  behindLeader,
  focused,
  openPanel,
  onFocus,
  onTogglePanel,
  onSetBasket,
  onResetBasket,
  onFilingStatus,
}: Props) {
  const { city, result } = outcome;
  const ink = inkFor(city.currency);
  const unreachable = !Number.isFinite(outcome.requiredGross);
  const metric = scenario.countRetirement ? 'totalValueHome' : 'surplusHome';

  return (
    <motion.article
      layout
      layoutId={city.id}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      onClick={onFocus}
      className={`plate-card relative cursor-pointer ring-1 transition-all ${
        focused ? 'ring-line' : 'ring-line/40 hover:ring-line'
      } ${outcome.freshness === 'unverified' ? 'opacity-60' : ''} ${
        leader && !unreachable ? 'sm:-translate-y-1' : ''
      }`}
      style={{
        boxShadow:
          leader && !unreachable
            ? `0 18px 40px -24px ${ink}cc, inset 0 0 0 1px ${ink}55`
            : focused
              ? `inset 0 0 0 1px ${ink}33`
              : undefined,
      }}
    >
      {/* The leader wears the city's ink as a full band; the rest get a hairline,
          so the winner is legible at a glance across the row. */}
      <div
        style={{ background: ink, height: leader && !unreachable ? 4 : 2 }}
      />

      {/* Leader gets a faint ink wash pooling under the headline number. */}
      {leader && !unreachable && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background: `radial-gradient(120% 80% at 20% 0%, ${ink}1f 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative p-4">
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[22px] leading-tight text-ink">
            {city.name}
          </h3>
          {leader && !unreachable && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-medium tracking-[0.12em] uppercase text-ground"
              style={{ background: ink, boxShadow: `0 0 16px -2px ${ink}88` }}
            >
              smallest ask
            </span>
          )}
        </header>

        {/* 1. Required gross, the number the user is going to negotiate for.
            Rendered in the city's own ink: the identity system doing real work
            rather than three interchangeable white numbers. */}
        <div className="mt-2.5">
          <p className="eyebrow">Ask for, before tax</p>
          {unreachable ? (
            <p className="mt-1 font-display text-[30px] leading-none text-muted">
              out of reach
            </p>
          ) : (
            <>
              <AnimatedNumber
                value={outcome.requiredGross}
                format={(v) => moneyCompact(v, city.currency)}
                className="mt-1 block font-mono text-[36px] leading-none font-medium"
                style={{ color: ink }}
              />
              <AnimatedNumber
                value={outcome.requiredGrossHome}
                format={(v) => money(v, homeCurrency)}
                className="tnum mt-1 block font-mono text-[11.5px] text-muted"
              />
              {behindLeader && (
                <p className="tnum mt-0.5 font-mono text-[11px] text-faint">
                  {money(behindLeader.extraHome, homeCurrency)} more than{' '}
                  {behindLeader.name}
                </p>
              )}
            </>
          )}
        </div>

        {/* 2. Surplus, the figure the modes trade off. */}
        <dl className="mt-3 border-t border-line pt-2.5">
          <div>
            <dt className="eyebrow">Left over a year</dt>
            <dd className="mt-0.5">
              <AnimatedNumber
                value={result[metric]}
                format={(v) => money(v, homeCurrency)}
                className="font-mono text-[16px] text-ink"
              />
            </dd>
          </div>
        </dl>

        {/* 4. Supporting evidence, small. */}
        <p className="mt-2.5 font-mono text-[11px] text-muted">
          {percent(result.effectiveTaxRate)} tax ·{' '}
          {money(outcome.livingCost + result.healthCost, city.currency)} to live
          {result.employerRetirement > 0 && (
            <>
              {' '}
              · {money(result.retirementNetOfTax, city.currency)} retirement
            </>
          )}
        </p>

        {/* Filing status belongs to whichever city actually files that way. It
            moved off the global setup panel because it changes this card's tax
            and nothing else on the page. */}
        {city.filingStatuses?.length ? (
          <div
            className="mt-2.5 flex items-baseline justify-between gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <label
              htmlFor={`filing-${city.id}`}
              className="font-mono text-[11px] text-muted"
            >
              You file as
            </label>
            <select
              id={`filing-${city.id}`}
              value={scenario.filingStatus}
              onChange={(event) =>
                onFilingStatus(event.target.value as Scenario['filingStatus'])
              }
              className="border-b border-line bg-transparent pb-[1px] text-right font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
            >
              <option value="single" className="bg-plate">
                Single
              </option>
              <option value="married_joint" className="bg-plate">
                Married, jointly
              </option>
            </select>
          </div>
        ) : null}

        {/* Drill-down tabs. Bordered chips so they read as controls, not
            leftover text — and a leading "Break it down" cue so a first-timer
            knows they open something. */}
        <div className="mt-3.5 border-t border-line pt-3">
          <p className="eyebrow mb-2">Show me the numbers</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PANEL_LABEL) as Panel[]).map((panel) => {
              const active = openPanel === panel;
              return (
                <button
                  key={panel}
                  type="button"
                  aria-expanded={active}
                  // Deliberately allowed to bubble: opening a drill-down is also
                  // a statement about which city you are looking at, so the
                  // ribbon should follow you there.
                  onClick={() => onTogglePanel(panel)}
                  className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    active
                      ? 'border-transparent bg-ink text-ground'
                      : 'border-line text-muted hover:border-muted hover:text-ink'
                  }`}
                >
                  {PANEL_LABEL[panel]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drill-downs expand in place. Not a modal, not a new page. */}
        <AnimatePresence initial={false}>
          {openPanel && (
            <motion.div
              key={openPanel}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 32 }}
              className="overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pt-4">
                {openPanel === 'tax' && <BracketLadder result={result} ink={ink} />}

                {openPanel === 'living' && (
                  <BasketEditor
                    outcome={outcome}
                    filingStatus={scenario.filingStatus}
                    preTaxDeductions={scenario.preTaxDeductions}
                    homeCurrency={homeCurrency}
                    ink={ink}
                    overrides={scenario.basketOverrides[city.id] ?? {}}
                    onSet={(categoryId, annual) =>
                      onSetBasket(city.id, categoryId, annual)
                    }
                    onReset={(categoryId) => onResetBasket(city.id, categoryId)}
                  />
                )}

                {openPanel === 'surplus' && (
                  <Waterfall
                    outcome={outcome}
                    homeCurrency={homeCurrency}
                    ink={ink}
                    countRetirement={scenario.countRetirement}
                  />
                )}

                {openPanel === 'goal' && (
                  <GoalCurve
                    goal={scenario.goal}
                    annualSurplus={result[metric]}
                    crossover={outcome.years}
                    homeCurrency={homeCurrency}
                    ink={ink}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tax figures never appear without their stamp and a way through to
            the source. One line does that; the full list is one click away. */}
        <footer className="mt-4 border-t border-line pt-2.5">
          <p className="font-mono text-[10px] text-faint">
            <a
              href={city.sources[0]?.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
              className="underline underline-offset-2 hover:text-ink"
            >
              {city.taxYearLabel} rates, {city.verified ? 'verified' : 'seeded'}{' '}
              {shortDate(city.asOf)}
            </a>
            {outcome.freshness !== 'fresh' && (
              <span className="text-ink"> · {outcome.freshness}</span>
            )}
          </p>
          {city.sources.length > 1 && (
            <details className="mt-1" onClick={(event) => event.stopPropagation()}>
              <summary className="cursor-pointer list-none font-mono text-[10px] text-faint marker:content-none hover:text-ink">
                {city.sources.length} sources
              </summary>
              <ul className="mt-1 space-y-1">
                {city.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-[10px] text-muted underline underline-offset-2 hover:text-ink"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </footer>
      </div>
    </motion.article>
  );
}

/** Gross → net → surplus → home currency, as a list of signed steps. */
function Waterfall({
  outcome,
  homeCurrency,
  ink,
  countRetirement,
}: {
  outcome: CityOutcome;
  homeCurrency: string;
  ink: string;
  countRetirement: boolean;
}) {
  const { result, city } = outcome;
  const steps: { label: string; value: number; emphasis?: boolean }[] = [
    { label: 'Gross comp', value: result.grossComp, emphasis: true },
    { label: 'Income tax', value: -result.incomeTax },
    ...(result.levies ? [{ label: 'Levies', value: -result.levies }] : []),
    ...(result.payrollTax ? [{ label: 'Payroll', value: -result.payrollTax }] : []),
    ...(result.healthCost ? [{ label: 'Health', value: -result.healthCost }] : []),
    { label: 'Net income', value: result.netIncome, emphasis: true },
    { label: 'Living cost', value: -result.livingCost },
    { label: 'Surplus', value: result.surplusLocal, emphasis: true },
  ];

  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`flex items-baseline justify-between gap-3 font-mono text-[11.5px] ${
            step.emphasis ? 'border-t border-line pt-1 text-ink' : 'text-muted'
          }`}
        >
          <span>{step.label}</span>
          <span className="tnum">{money(step.value, city.currency)}</span>
        </div>
      ))}
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 font-mono text-[12px]">
        <span className="text-muted">
          at {outcome.fxToHome.toFixed(4)} {homeCurrency}/{city.currency}
        </span>
        <span className="tnum" style={{ color: ink }}>
          {money(result.surplusHome, homeCurrency)}
        </span>
      </div>
      {result.employerRetirement > 0 && (
        <p className="pt-1 font-mono text-[11px] text-muted">
          plus {money(result.retirementHome, homeCurrency)} retirement,{' '}
          {countRetirement ? 'counted' : 'not counted'} toward the goal
        </p>
      )}
    </div>
  );
}

export type { Panel };
