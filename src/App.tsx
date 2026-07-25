import { useMemo, useState } from 'react';
import { CITIES } from './data/cities';
import { compare, type Mode } from './engine/scenario';
import { money, shortDate } from './lib/format';
import { useFx } from './state/useFx';
import { useScenario } from './state/useScenario';
import { CityCard, type Panel } from './ui/CityCard';
import { Disclosure } from './ui/Disclosure';
import { FlowRibbon } from './ui/FlowRibbon';
import { FxPanel } from './ui/FxPanel';
import { Guilloche } from './ui/Guilloche';
import { ModeSelector } from './ui/ModeSelector';
import { SetupPanel } from './ui/SetupPanel';

const CURRENCIES = [...new Set(CITIES.map((city) => city.currency))];

export default function App() {
  const { scenario, update } = useScenario();
  const homeCity = CITIES.find((c) => c.id === scenario.homeCityId) ?? CITIES[0];
  const { table: fx, history, live } = useFx(homeCity.currency, CURRENCIES);

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
      <Guilloche className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.07]" />

      <div className="relative mx-auto max-w-[1360px] px-6 py-10 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <h1 className="font-display text-[40px] leading-none text-ink">Roundtrip</h1>
            <p className="mt-2 max-w-prose font-sans text-[14px] leading-relaxed text-muted">
              What salary do I need over there, and what does it actually get me back
              home.
            </p>
          </div>
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
              onChange={update}
            />
            <div className="border-t border-line pt-4">
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
          </aside>

          <main className="min-w-0 space-y-8">
            <ModeSelector
              mode={scenario.mode}
              onChange={(mode: Mode) => update({ mode })}
            />

            <section
              aria-label={`Where ${focused.city.name} money goes`}
              className="border-y border-line py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-[18px] text-ink">
                  {focused.city.name}
                </h2>
                <p className="tnum font-mono text-[11px] text-muted">
                  {money(focused.result.surplusHome, homeCity.currency)} a year lands
                  home
                </p>
              </div>
              <FlowRibbon
                outcome={focused}
                goal={scenario.goal}
                homeCurrency={homeCity.currency}
                countRetirement={scenario.countRetirement}
              />
            </section>

            <section
              aria-label="City comparison"
              className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {comparison.outcomes.map((outcome, index) => (
                <CityCard
                  key={outcome.city.id}
                  outcome={outcome}
                  scenario={scenario}
                  homeCurrency={homeCity.currency}
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
            </section>

            {comparison.outcomes.some((o) => o.city.notes?.length) && (
              <Disclosure summary="Assumptions" className="border-t border-line pt-5">
                <ul className="grid gap-4 md:grid-cols-3">
                  {comparison.outcomes.map((outcome) => (
                    <li key={outcome.city.id}>
                      <p
                        className="font-mono text-[10.5px] tracking-wide uppercase"
                        style={{ color: `var(--ink-${outcome.city.currency})` }}
                      >
                        {outcome.city.name}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {(outcome.city.notes ?? []).map((note) => (
                          <li
                            key={note}
                            className="font-sans text-[11px] leading-relaxed text-muted"
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

        <footer className="mt-12 border-t border-line pt-5">
          <p className="font-mono text-[10.5px] leading-relaxed text-muted">
            Estimates only. Not tax or financial advice. Tax figures are seeded from
            the sources linked on each card; rates from{' '}
            <a
              href="https://frankfurter.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-ink"
            >
              Frankfurter
            </a>
            . Your scenario is in this page's URL.
          </p>
        </footer>
      </div>
    </div>
  );
}
