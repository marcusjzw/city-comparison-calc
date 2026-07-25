# Data: where the numbers come from and how they stay right

A calculator that silently uses last year's brackets is worse than no
calculator. This file records what is verified, what is not, and how the data is
meant to be kept current.

## The governing decision

The app never calls a tax API at request time. A scheduled job fetches,
normalises, validates and commits static JSON, and the app ships that JSON.

- A bracket change should be reviewable as a diff before it reaches users.
- The app is client-only, so a runtime call would put API keys in the bundle.
- A third party going down must not take the calculator down.
- Tax rules change a few times a year. Fetching them per pageview is absurd.

FX is the single exception and is fetched at runtime, because it genuinely
changes daily. See "FX" below.

## Status of the seeded records

| City | Tax year | `verified` | Notes |
|---|---|---|---|
| Sydney | 2025-26 | **false** | Brackets, 2% Medicare levy, 12% SG, Div 293 at $250k |
| Singapore | YA2026 | **false** | Full 13-step resident ladder, no CPF (Employment Pass) |
| San Francisco | 2026 | **false** | Federal + California + FICA, single and joint |

`verified: false` means the figures were seeded from the build brief and have
not been read off the primary source in `sources[]`. The UI renders "seeded" in
place of "verified" on every card. Flipping a record to `true` means somebody
opened the government page and checked every number, and it is the single
highest-value task in the backlog.

Known open questions in the seed data:

- **California standard deduction.** Public sources quote both $5,540 and $5,706.
  This uses $5,706. Take it from the FTB schedule.
- **California brackets** are 2025 figures. 2026 indexation is not applied.
- **Australian tax year.** This ships 2025-26. The 16% band falls to 15% from
  1 July 2026 and 14% from 1 July 2027. Model those as separate dated records
  rather than editing this one, and add a year selector.
- **US Social Security wage base** of $184,500 is the 2026 figure. It is indexed
  annually and the 2025 figure of $176,100 is still widely republished as
  current. Read it from the SSA contribution and benefit base page each year.

## Three traps in upstream data

Each of these produces silently wrong numbers, and each is encoded as an
assertion in `src/engine/*.test.ts` rather than as a comment.

**1. Bracket thresholds are sometimes post-allowance, not gross.** Australia is
published by some aggregators as 15% from $0 to $26,800 with a separate $18,200
allowance — that is the ATO ladder minus the tax-free threshold. Both
conventions are correct, they are just different, and feeding one into the other
is wrong by thousands of dollars without erroring. This repo states Australian
thresholds on gross taxable income (allowance as the first bracket) and US
federal thresholds after the standard deduction (applied inside the rule via
`standardDeduction`). `tax.test.ts > bracket convention` asserts both.

**2. Social security fields describe the default resident, not your user.**
Singapore is published with CPF at 20% capped at S$102,000 — that is the citizen
and permanent resident rate, and an Employment Pass holder contributes nothing.
Australia is published as "employee: no mandatory contributions", which is true
of the employee side and completely misses the 12% employer superannuation
guarantee. Treat every social security field as needing a residency-status
qualifier the source does not provide. `data.test.ts > residency-status
qualifiers` asserts both.

**3. US and Canada are federal only in most sources.** No California, no state
layer at all — and California adds up to 13.3%, which is the entire point of
modelling San Francisco. `CityData.requiredRules` names the rule ids a city may
not ship without, and `validateCity` fails the build if one is missing, so a
future US city cannot silently ship without its state layer.

## The pipeline (not built yet)

```
fetch → normalise → validate → diff → gate → commit
```

A GitHub Action on a weekly cron plus manual dispatch.

- **Fetch.** Pull each source into `raw/{source}/{timestamp}.json` and commit the
  raw payloads. Having the exact upstream response when a number is disputed is
  worth the repo weight.
- **Normalise.** Map to `CityData`. This is where the bracket-convention
  conversion lives, where residency-status overrides are applied, and where
  federal and state layers compose into one ordered `TaxRule[]`. Overrides live
  in a checked-in `overrides/{city}.json` that always wins over upstream.
- **Validate.** Run `validateCity` from `src/engine/validate.ts`. It already
  checks ladder ordering, unbounded top band, rates in [0, 1], currency codes,
  `asOf` presence, required rules, filing-status declaration, duplicate ids, and
  a non-decreasing effective rate at reference incomes. Do **not** add a marginal
  rate monotonicity check: the UK genuinely runs 40%, then 60% through the
  personal allowance taper, then 45%.
- **Diff and gate.** Compute impact, not textual change. No numeric change →
  commit silently. Required gross at reference incomes moves under 0.5% → commit
  with a changelog entry. Anything larger, any new city, any validation warning →
  open a PR with a before-and-after table of required gross per city, and stop.
- **Golden tests as the final gate.** Re-run `golden.test.ts` against the new
  data. Any failure blocks the merge outright, no override. If new brackets break
  the Sydney baseline, either the data is wrong or the engine is, and both need a
  human.

Roughly ninety percent of updates should land with no human involvement. The ten
percent that materially move someone's relocation decision get thirty seconds of
human attention. Fully autonomous tax data is not a goal worth having.

### Sources to evaluate

| Source | Covers | Cost | Verdict |
|---|---|---|---|
| RemoteTaxCalc `/api/tax-rates` | 27 countries, national brackets, social security | Free, CC BY 4.0 | Primary seed candidate. **Endpoint shape unconfirmed — curl it before writing the normaliser.** Attribute in the footer. |
| API Ninjas Income Tax | US states and Canadian provinces | Free tier, key required | Fills the US state gap. Free-tier limits for a public product unconfirmed. |
| Primary government pages | ATO, IRAS, IRS, FTB, SSA | Free | Ground truth for tier-1 cities. Always the tiebreaker. |

Unresolved: whether RemoteTaxCalc exposes filing status at all. The published
tables look single-filer only. If joint brackets are absent, the US layer needs
a second source or a permanent override file, which changes the build order.

For jurisdictions no API covers, LLM extraction from the official rates page is
reasonable **to draft a pull request**, never to skip one. Require independent
agreement from a second source before anything can auto-merge. A hallucinated
bracket threshold is indistinguishable from a real one in the output, and the
user's only signal that their relocation maths was wrong arrives years later.

## FX

`src/data/fx.ts`. Frankfurter at `api.frankfurter.dev`: free, keyless,
quota-free, central bank reference rates, self-hostable.

- Fetched at runtime, cached 12 hours in localStorage, last good response kept
  as a fallback, seed table as the final fallback.
- Reference rates publish once per business day, so per-pageview fetching gains
  nothing.
- A ten-year monthly series is fetched for the FX panel's range indicator. Moving
  this to a build-time static JSON would remove the second request; it is
  currently a live call that fails soft.

## Cost of living

The hardest thing to automate honestly, and the one where the tempting option is
the wrong one. Numbeo's API is around $260/month and its licence restricts
redistribution, which is a problem for an app that ships the basket to the
client. Scraping it is a licence and reliability risk not worth taking.

Instead: WhereNext (free, CC BY 4.0, ~380 cities, built on World Bank ICP, OECD
and Eurostat data), with World Bank ICP price level indices as a sanity check.
Whether WhereNext exposes per-category figures or only composite indices is
unconfirmed, and the ten-category basket in `CityData.colBasket` assumes
per-category.

Rent is handled separately. It dominates the basket, drives the sensitivity
ranking, and is the weakest part of every aggregate index. Source it per city
from local rental data with its own review cadence.

Every basket category carries a `confidence` of `institutional`, `derived` or
`estimated`, surfaced in the drill-down. Today every housing line is `estimated`
— which is exactly the nudge that should make a user type their own number in.

## Staleness is a UI state

Every record carries `asOf` and `freshnessDays` (180). `staleness()` in
`forward.ts` returns `fresh`, `stale` (past the window) or `unverified` (past
twice it). The app shows a quiet source stamp when fresh, a persistent banner
naming the affected city when stale, and de-emphasises the card when unverified.

Stale data that announces itself is acceptable. Stale data that looks current is
the thing this whole apparatus exists to prevent.
