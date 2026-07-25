import { useMemo, useState } from 'react';
import { CITIES } from './data/cities';
import { compare, type Mode } from './engine/scenario';
import { detectCurrencyFromEnvironment } from './lib/detectCurrency';
import { inkFor, shortDate } from './lib/format';
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

const CURRENCIES = [...new Set(CITIES.map((city) => city.currency))];

export default function App() {
  const { scenario, update } = useScenario();

  // What the reader is shown, as opposed to what each city pays and taxes in.
  const displayCurrency = scenario.displayCurrency;

  // Read once per session. Re-running it would fight the reader's own choice.
  const [detection] = useState(detectCurrencyFromEnvironment);

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

  return (
    <div className="relative min-h-screen">
      <Guilloche className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.06]" />
      <div className="rule-tricolor fixed inset-x-0 top-0 z-10" />

      <div className="relative mx-auto max-w-[1360px] px-6 py-12 lg:px-10">
        <header className="border-b border-line pb-7">
          {/* The currency control rides the eyebrow line rather than sitting
              beside the masthead: it is a setting, not a headline, and this
              keeps the title, standfirst and reading order untouched. */}
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <p className="eyebrow">Salary, converted · three cities</p>
            <CurrencySelector
              value={displayCurrency}
              detection={detection}
              live={live}
              onChange={(currency) => update({ displayCurrency: currency })}
            />
          </div>
          <h1 className="mt-3 font-display text-[52px] leading-[0.95] text-ink">
            Roundtrip
          </h1>
          <p className="mt-3 max-w-[52ch] font-sans text-[15px] leading-relaxed text-muted">
            What salary do I need over there, and what does it actually get me back
            home? Set your situation on the left, pick what you are optimising for,
            and read it off the cards.
          </p>
        </header>

        {stale.length > 0 && (
          <div className="mt-4 border-l-2 border-ink bg-plate/60 px-4 py-3">
            <p className="font-mono text-[11.5px] text-ink">
              {stale
                .map(
                  (o) =>
                    `${o.city.name} rates last checked ${shortDate(o.city.asOf)} (${o.freshness})`,
                )
                .join(' · ')}
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-8">
            <SetupPanel
              scenario={scenario}
              comparison={comparison}
              cities={CITIES}
              mode={scenario.mode}
              onChange={update}
            />
            {/* FX is a power feature: consequential for a repatriating saver, but
                not something to put in a newcomer's face. It waits behind an
                expander until asked for. */}
            <details className="group border-t border-line pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-muted transition-colors hover:text-ink">
                <span className="font-mono text-[13px] text-faint transition-transform group-open:rotate-90">
                  ›
                </span>
                <span className="eyebrow">Advanced · exchange-rate assumptions</span>
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
          </aside>

          <main className="min-w-0 space-y-8">
            <ModeSelector
              mode={scenario.mode}
              onChange={(mode: Mode) => update({ mode })}
            />

            {/* The answer comes first: three cities, ranked by the smallest
                salary you'd have to ask for. The flow ribbon is the detail and
                sits below, so a newcomer reads the result before the chart. */}
            <section aria-label="City comparison">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">The ask, ranked · smallest first</p>
                <p className="font-mono text-[11px] text-faint">
                  each shows the gross comp you'd negotiate for
                </p>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                {comparison.outcomes.map((outcome, index) => (
                  <CityCard
                    key={outcome.city.id}
                    outcome={outcome}
                    scenario={scenario}
                    homeCurrency={displayCurrency}
                    rank={index + 1}
                    leader={index === 0}
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
                  />
                ))}
              </div>
            </section>

            <section
              aria-label={`Where ${focused.city.name} money goes`}
              className="border-t border-line pt-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="eyebrow">Where the money goes</p>
                  <div className="mt-1.5 flex items-baseline gap-2.5">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: inkFor(focused.city.currency) }}
                    />
                    <h2 className="font-display text-[20px] text-ink">
                      {focused.city.name}
                    </h2>
                  </div>
                </div>
                <p className="font-mono text-[11px] text-faint">
                  selected card · click another to switch
                </p>
              </div>

              {/* A one-line reading key so the ribbon isn't a mystery chart. */}
              <p className="mt-2 max-w-[70ch] font-sans text-[12.5px] leading-relaxed text-muted">
                Gross pay enters from the left and splits into{' '}
                <span className="text-ink">tax</span> and{' '}
                <span className="text-ink">living cost</span>; what's left — your{' '}
                <span style={{ color: inkFor(focused.city.currency) }}>surplus</span> —
                crosses the horizon, converts to {displayCurrency}, and fills the{' '}
                <span style={{ color: inkFor(displayCurrency) }}>reservoir</span> toward
                your goal line.
              </p>

              <FlowRibbon
                outcome={focused}
                goal={scenario.goal}
                homeCurrency={displayCurrency}
                countRetirement={scenario.countRetirement}
              />
            </section>

            {comparison.outcomes.some((o) => o.city.notes?.length) && (
              <Disclosure
                summary="Assumptions & limits — what this model does and does not do"
                className="border-t border-line pt-5"
              >
                <ul className="grid gap-5 md:grid-cols-3">
                  {comparison.outcomes.map((outcome) => (
                    <li key={outcome.city.id}>
                      <p
                        className="font-mono text-[10.5px] tracking-[0.1em] uppercase"
                        style={{ color: `var(--ink-${outcome.city.currency})` }}
                      >
                        {outcome.city.name}
                      </p>
                      <ul className="mt-2 space-y-1.5">
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
          </main>
        </div>

        <footer className="mt-14 grid gap-4 border-t border-line pt-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="max-w-[70ch] font-mono text-[10.5px] leading-relaxed text-faint">
            Exchange rates from{' '}
            <a
              href="https://frankfurter.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted underline underline-offset-2 hover:text-ink"
            >
              Frankfurter
            </a>
            . Your scenario is in this page's URL.
          </p>
          <p className="max-w-[34ch] font-mono text-[10.5px] leading-relaxed text-faint md:text-right">
            Estimates only. Not tax or financial advice. Every figure is reproducible
            from the sources on each card — check them before you negotiate.
          </p>
        </footer>
      </div>
    </div>
  );
}
