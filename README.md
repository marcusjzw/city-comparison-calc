# Roundtrip

What salary do I need over there, and what does it actually get me back home.

Every cost-of-living calculator answers one question: what keeps my lifestyle the
same. That is close to useless to the people who move for money, because they are
not maintaining a lifestyle, they are accumulating capital in their home currency
for a specific thing. Roundtrip answers three questions and lets you switch
between them.

1. **Lifestyle parity** — the gross comp that keeps your standard of living identical.
2. **Savings parity** — the gross comp that keeps your annual savings identical in home-currency terms.
3. **Goal** — the gross comp that gets you to a home-currency target by a date.

Mode 3 is the reason this exists. It is where tax, cost of living and the
exchange rate compound in the same direction, and where the answer routinely
inverts the conventional wisdom.

## Running it

Node 20.19+ (`.nvmrc` pins 22).

```bash
nvm use          # or any Node >= 20.19
npm install
npm run dev      # http://localhost:5173
npm test         # engine + data invariants, 103 tests
npm run build
```

## Shape of the thing

```
src/engine/     pure TypeScript, zero DOM. The UI is a skin over this.
  types.ts      TaxRule, CityData, ForwardResult
  tax.ts        bracket walk and rule application
  forward.ts    gross → tax → net → surplus → home currency
  solve.ts      bisection, years to goal, category sensitivity
  basket.ts     cost of living, scale mode and basket mode
  scenario.ts   the three modes, ranking, one pure compare()
  validate.ts   ingestion invariants (also the ingestion pipeline's gate)
src/data/       versioned JSON per city, plus runtime FX
src/state/      React hooks: scenario (URL hash + localStorage), live FX, theme
src/lib/        currency formatting, environment-based currency detection
src/ui/         React. Nothing in here is imported by the engine.
```

Nothing in `src/engine` imports React, and nothing in `src/data/cities` is
special-cased in code. **Adding Lisbon, Dubai, London or Austin is a data task**:
write `src/data/cities/lisbon.json` against the `CityData` schema, add it to the
array in `src/data/cities/index.ts`, and the engine, the cards, the ribbon, the
drill-downs and the tests all pick it up. If you find yourself writing an
`if (city.id === …)`, the schema is wrong and that is the bug to fix.

Currency inks are assigned by currency in `src/index.css` (`--ink-AUD` and
friends), so a new city in an existing currency inherits its identity colour and
a new currency needs one line.

## Correctness

`npm test` runs the golden cases from the brief, parameterised on FX so the
expectations move with the rates rather than being frozen:

| Case | Expected | Engine |
|---|---|---|
| Sydney A$181,500 + A$130,000 equity | net ≈ A$199,000, ≈ 36% effective | A$198,957, 36.13% |
| Sydney surplus against A$99,000 costs | ≈ A$100,000 | A$99,957 |
| Singapore, A$100,000 surplus | ≈ S$217,000 | S$217,769 |
| Singapore, A$120,000 surplus | ≈ S$240,000 | S$239,991 |
| San Francisco, A$100,000 surplus | ≈ US$224,000 | US$224,796 |
| San Francisco, A$120,000 surplus | ≈ US$245,000 | US$245,982 |
| SF filing delta, single vs joint | ≈ US$30,000 | US$27,782 |

One clarification the numbers forced: the brief's "SF sole earner" row is the
**married filing jointly** case. One earner in a couple files jointly, and that
is what US$224,000 and US$245,000 describe. Filing single at the same targets
needs US$252,578 and US$278,084 — which is exactly the ~US$30,000 delta the
brief's last row predicts. Both readings are now asserted.

The suite also gates the data itself: bracket ladders sorted with an unbounded
top band, rates inside [0, 1], provenance present, the ten-category basket
complete with a confidence on every line, and the effective rate non-decreasing
across reference incomes. It deliberately does **not** assert that marginal
rates increase monotonically — the UK genuinely runs 40%, then 60% through the
personal allowance taper, then 45%, and a naive check would reject correct data.

## Where the build is

Ships steps 1 to 5 of the brief, plus 6 and 7, and most of 8.

- [x] Engine and golden tests
- [x] City JSON for Sydney, Singapore, San Francisco with sources on every record
- [x] Comparison screen wired live to the engine
- [x] Design pass: banknote-ink palette, three currency inks, tabular figures throughout
- [x] The flow ribbon
- [x] Drill-downs: bracket walk, editable basket with sensitivity strip, surplus waterfall, goal curve
- [x] FX panel with a ±20% slider, live revaluation, and the ten-year range
- [x] Full scenario in the URL hash, last session in localStorage
- [ ] Named scenarios (up to five)
- [ ] The ingestion pipeline — see [docs/DATA.md](docs/DATA.md)

**Every tax figure currently ships as `verified: false`** and says so on the card.
They are seeded from the brief, not read off the primary source. That is the
first thing to fix; `docs/DATA.md` says how.

## Not modelled

Capital gains tax, AMT, itemised deductions, treaties, foreign income exclusions,
visa costs and eligibility, and partner income as a separate earner. The US
filing status toggle is the only concession to a second person in the household.

Estimates only. Not tax or financial advice.
