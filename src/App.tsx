import { useMemo, useState } from 'react';
import { CITIES } from './data/cities';
import { compare, type Mode } from './engine/scenario';
import { inkFor, moneyCompact, shortDate } from './lib/format';
import { useFx } from './state/useFx';
import { useScenario } from './state/useScenario';
import { CityCard, type Panel } from './ui/CityCard';
import { CurrencySelector } from './ui/CurrencySelector';
import { Disclosure } from './ui/Disclosure';
import { FlowRibbon } from './ui/FlowRibbon';
import { FxPanel } from './ui/FxPanel';
import { Guilloche } from './ui/Guilloche';
import { ModeSelector } from './ui/ModeSelector';
import { SetupPanel } from './ui/SetupPanel';
import { Step } from './ui/Step';

const CURRENCIES = [...new Set(CITIES.map((city) => city.currency))];

export default function App() {
  const { scenario, update } = useScenario();

  // What the reader is shown, as opposed to what each city pays and taxes in.
  const displayCurrency = scenario.displayCurrency;

  const { table: fx, history, live } = useFx(displayCurrency, CURRENCIES);

  const comparison = useMemo(
    () => compare(scenario, CITIES, fx),
    [scenario, fx],
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [panels, setPanels] = useState<Record<string, Panel | null>>({});

  const focused =
    comparison.outcomes.find((o) => o.city.id === focusedId) ?? comparison.outcomes[0];

  const setBasket = (cityId: string, categoryId: string, annual: number) =>
    update({
      basketOverrides: {
        ...scenario.basketOverrides,
        [cityId]: { ...scenario.basketOverrides[cityId], [categoryId]: annual },
      },
    });

  const resetBasket = (cityId: string, categoryId?: string) => {
    const next = { ...scenario.basketOverrides };
    if (categoryId === undefined) delete next[cityId];
    else {
      const city = { ...next[cityId] };
      delete city[categoryId];
      next[cityId] = city;
    }
    update({ basketOverrides: next });
  };

  const stale = comparison.outcomes.filter((o) => o.freshness !== 'fresh');

  // Outcomes arrive sorted by the smallest ask, so the winner is the first one.
  const leader = comparison.outcomes[0];

  return (
    <div className="relative min-h-screen">
      <Guilloche className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.06]" />
      <div className="rule-tricolor fixed inset-x-0 top-0 z-10" />

      <div className="relative mx-auto max-w-[1360px] px-6 pt-6 pb-10 lg:px-10">
        {/* One masthead row. The title, its one-line standfirst and the currency
            control share a baseline instead of stacking into a third of the
            screen, because the flow diagram below is the thing worth the space. */}
        <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-line pb-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-[34px] leading-none text-ink">
              Roundtrip
            </h1>
            <p className="font-sans text-[13.5px] leading-snug text-muted">
              What salary you need over there — and what it's worth back home.
            </p>
          </div>
          <CurrencySelector
            value={displayCurrency}
            live={live}
            onChange={(currency) => update({ displayCurrency: currency })}
          />
        </header>

        {stale.length > 0 && (
          <div className="mt-3 border-l-2 border-ink bg-plate/60 px-3 py-2">
            <p className="font-mono text-[11px] text-ink">
              Rates last checked:{' '}
              {stale
                .map((o) => `${o.city.name} ${shortDate(o.city.asOf)}`)
                .join(' · ')}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-7">
            <Step n={1} title="Tell us where you are" hint="Your pay and savings today.">
              <SetupPanel
                scenario={scenario}
                comparison={comparison}
                cities={CITIES}
                mode={scenario.mode}
                onChange={update}
              />
            </Step>
            {/* FX is a power feature: consequential for a repatriating saver, but
                not something to put in a newcomer's face. It waits behind an
                expander until asked for. */}
            <details className="group border-t border-line pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-muted transition-colors hover:text-ink">
                <span className="font-mono text-[13px] text-faint transition-transform group-open:rotate-90">
                  ›
                </span>
                <span className="eyebrow">Exchange rates</span>
              </summary>
              <div className="mt-4">
                <FxPanel
                  fx={fx}
                  history={history}
                  live={live}
                  comparison={comparison}
                  scenario={scenario}
                  onShift={(currency, shift) =>
                    update({ fxShifts: { ...scenario.fxShifts, [currency]: shift } })
                  }
                />
              </div>
            </details>

            {/* Caveats sit in the sidebar with the other reference material,
                which also stops the left column running dry a full screen
                before the right one does. */}
            {comparison.outcomes.some((o) => o.city.notes?.length) && (
              <Disclosure
                summary="Assumptions & limits"
                className="border-t border-line pt-4"
              >
                <ul className="space-y-4">
                  {comparison.outcomes.map((outcome) => (
                    <li key={outcome.city.id}>
                      <p
                        className="font-mono text-[10.5px] tracking-[0.1em] uppercase"
                        style={{ color: `var(--ink-${outcome.city.currency})` }}
                      >
                        {outcome.city.name}
                      </p>
                      <ul className="mt-1.5 space-y-1.5">
                        {(outcome.city.notes ?? []).map((note) => (
                          <li
                            key={note}
                            className="font-sans text-[11.5px] leading-relaxed text-muted"
                          >
                            {note}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </aside>

          <main className="min-w-0 space-y-7">
            <Step n={2} title="Pick what matters">
              <ModeSelector
                mode={scenario.mode}
                onChange={(mode: Mode) => update({ mode })}
              />
            </Step>

            {/* Answer, then evidence, then comparison. The sentence carries the
                number, the ribbon shows how that number survives tax, rent and
                the exchange rate, and the cards are where you go to argue with
                it. The ribbon sits above the cards because it is the thing
                worth looking at first, not a footnote to them. */}
            <Step n={3} title="Here's what to ask for">
              {/* Say the answer in a sentence before drawing anything.
                  A first-timer should not have to infer the ordering. */}
              {leader && (
                <p className="max-w-[64ch] font-sans text-[14px] leading-relaxed text-ink">
                  {Number.isFinite(leader.requiredGross) ? (
                    <>
                      <span style={{ color: inkFor(leader.city.currency) }}>
                        {leader.city.name}
                      </span>{' '}
                      asks least: about{' '}
                      <span className="font-mono">
                        {moneyCompact(leader.requiredGross, leader.city.currency)}
                      </span>{' '}
                      a year, before tax.
                    </>
                  ) : (
                    <>No city clears this bar yet. Try a longer timeline or a
                    smaller target in step 1.</>
                  )}
                </p>
              )}

              <section
                aria-label={`Where ${focused.city.name} money goes`}
                className="mt-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  {/* The ribbon draws one city, so it carries its own city
                      switch rather than depending on a card further down the
                      page that you may not have scrolled to yet. */}
                  <div
                    role="tablist"
                    aria-label="City shown in the flow diagram"
                    className="flex flex-wrap gap-1"
                  >
                    {comparison.outcomes.map((outcome) => {
                      const selected = outcome.city.id === focused.city.id;
                      const cityInk = inkFor(outcome.city.currency);
                      return (
                        <button
                          key={outcome.city.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setFocusedId(outcome.city.id)}
                          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11.5px] transition-colors ${
                            selected
                              ? 'border-line bg-plate text-ink'
                              : 'border-transparent text-muted hover:text-ink'
                          }`}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              background: cityInk,
                              opacity: selected ? 1 : 0.4,
                            }}
                          />
                          {outcome.city.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* A one-line reading key so the ribbon isn't a mystery chart. */}
                  <p className="font-sans text-[12px] leading-snug text-muted">
                    Pay in from the left; <span className="text-ink">tax</span> and{' '}
                    <span className="text-ink">living cost</span> peel off, the{' '}
                    <span style={{ color: inkFor(focused.city.currency) }}>
                      surplus
                    </span>{' '}
                    converts to {displayCurrency}.
                  </p>
                </div>

                <FlowRibbon
                  outcome={focused}
                  goal={scenario.goal}
                  homeCurrency={displayCurrency}
                  countRetirement={scenario.countRetirement}
                />
              </section>

              <p className="eyebrow mt-5 mb-2.5">
                All three, cheapest ask first
              </p>
              <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {comparison.outcomes.map((outcome, index) => (
                  <CityCard
                    key={outcome.city.id}
                    outcome={outcome}
                    scenario={scenario}
                    homeCurrency={displayCurrency}
                    leader={index === 0}
                    behindLeader={
                      index === 0 ||
                      !leader ||
                      !Number.isFinite(outcome.requiredGrossHome) ||
                      !Number.isFinite(leader.requiredGrossHome)
                        ? null
                        : {
                            name: leader.city.name,
                            extraHome:
                              outcome.requiredGrossHome - leader.requiredGrossHome,
                          }
                    }
                    focused={outcome.city.id === focused.city.id}
                    openPanel={panels[outcome.city.id] ?? null}
                    onFocus={() => setFocusedId(outcome.city.id)}
                    onTogglePanel={(panel) =>
                      setPanels((current) => ({
                        ...current,
                        [outcome.city.id]:
                          current[outcome.city.id] === panel ? null : panel,
                      }))
                    }
                    onSetBasket={setBasket}
                    onResetBasket={resetBasket}
                    onFilingStatus={(filingStatus) => update({ filingStatus })}
                  />
                ))}
              </div>
            </Step>

          </main>
        </div>

        <footer className="mt-14 grid gap-4 border-t border-line pt-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="font-mono text-[10.5px] leading-relaxed text-faint">
            Rates from{' '}
            <a
              href="https://frankfurter.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted underline underline-offset-2 hover:text-ink"
            >
              Frankfurter
            </a>
            . Your scenario is saved in this page's URL — copy it to share.
          </p>
          <p className="font-mono text-[10.5px] leading-relaxed text-faint md:text-right">
            Estimates, not advice. Check the sources on each card.
          </p>
        </footer>
      </div>
    </div>
  );
}
