import { AnimatePresence, motion } from 'motion/react';
import type { CityOutcome, Scenario } from '../engine/scenario';
import { inkFor, money, moneyCompact, percent, shortDate, years } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { BasketEditor } from './BasketEditor';
import { BracketLadder } from './BracketLadder';
import { GoalCurve } from './GoalCurve';

type Panel = 'tax' | 'living' | 'surplus' | 'goal';

const PANEL_LABEL: Record<Panel, string> = {
  tax: 'Tax',
  living: 'Living cost',
  surplus: 'Surplus',
  goal: 'Years to goal',
};

interface Props {
  outcome: CityOutcome;
  scenario: Scenario;
  homeCurrency: string;
  leader: boolean;
  focused: boolean;
  openPanel: Panel | null;
  onFocus: () => void;
  onTogglePanel: (panel: Panel) => void;
  onSetBasket: (cityId: string, categoryId: string, annual: number) => void;
  onResetBasket: (cityId: string, categoryId?: string) => void;
}

export function CityCard({
  outcome,
  scenario,
  homeCurrency,
  leader,
  focused,
  openPanel,
  onFocus,
  onTogglePanel,
  onSetBasket,
  onResetBasket,
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
      className={`relative cursor-pointer bg-plate/70 ring-1 transition-colors ${
        focused ? 'ring-line' : 'ring-line/40 hover:ring-line'
      } ${outcome.freshness === 'unverified' ? 'opacity-60' : ''}`}
      style={{ boxShadow: focused ? `inset 0 0 0 1px ${ink}33` : undefined }}
    >
      <div className="h-[3px]" style={{ background: ink }} />

      <div className="p-5">
        <header className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[22px] leading-none text-ink">
            {city.name}
          </h3>
          {leader && !unreachable && (
            <span
              className="font-mono text-[10px] tracking-wide uppercase"
              style={{ color: ink }}
            >
              smallest ask
            </span>
          )}
        </header>

        {/* 1. Required gross, the number the user is going to negotiate for. */}
        <div className="mt-5">
          <p className="font-mono text-[10.5px] tracking-wide text-muted uppercase">
            Gross comp needed
          </p>
          {unreachable ? (
            <p className="mt-1 font-display text-[34px] leading-none text-muted">
              out of reach
            </p>
          ) : (
            <>
              <AnimatedNumber
                value={outcome.requiredGross}
                format={(v) => moneyCompact(v, city.currency)}
                className="mt-1 block font-mono text-[40px] leading-none font-medium text-ink"
              />
              <AnimatedNumber
                value={outcome.requiredGrossHome}
                format={(v) => money(v, homeCurrency)}
                className="mt-2 block font-mono text-[13px] text-muted"
              />
            </>
          )}
        </div>

        {/* 2. Suggested split, on the same base-to-equity ratio as today. */}
        {!unreachable && (
          <p className="mt-3 font-mono text-[11px] text-muted">
            ≈ {money(outcome.suggestedSplit.base, city.currency)} base +{' '}
            {money(outcome.suggestedSplit.equity, city.currency)} equity
          </p>
        )}

        {/* 3 and 4. Surplus and years, the two figures the modes trade off. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
          <div>
            <dt className="font-mono text-[10.5px] tracking-wide text-muted uppercase">
              Surplus home
            </dt>
            <dd>
              <AnimatedNumber
                value={result[metric]}
                format={(v) => money(v, homeCurrency)}
                className="font-mono text-[16px] text-ink"
              />
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] tracking-wide text-muted uppercase">
              Years to goal
            </dt>
            <dd
              className="tnum font-mono text-[16px]"
              style={{ color: Number.isFinite(outcome.years) ? ink : undefined }}
            >
              {years(outcome.years)}
            </dd>
          </div>
        </dl>

        {/* 5. Supporting evidence, small. */}
        <p className="mt-4 font-mono text-[11px] text-muted">
          {percent(result.effectiveTaxRate)} effective ·{' '}
          {money(outcome.livingCost + result.healthCost, city.currency)} to live
          {result.employerRetirement > 0 && (
            <>
              {' '}
              · {money(result.retirementNetOfTax, city.currency)} retirement
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
          {(Object.keys(PANEL_LABEL) as Panel[]).map((panel) => (
            <button
              key={panel}
              type="button"
              aria-expanded={openPanel === panel}
              // Deliberately allowed to bubble: opening a drill-down is also a
              // statement about which city you are looking at, so the ribbon
              // should follow you there.
              onClick={() => onTogglePanel(panel)}
              className={`font-mono text-[11px] underline-offset-4 hover:text-ink ${
                openPanel === panel ? 'text-ink underline' : 'text-muted'
              }`}
            >
              {PANEL_LABEL[panel]}
            </button>
          ))}
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
        <footer className="mt-5 border-t border-line pt-3">
          <p className="font-mono text-[10px] text-muted">
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
              <summary className="cursor-pointer list-none font-mono text-[10px] text-muted marker:content-none hover:text-ink">
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
