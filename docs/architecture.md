# Design & Architecture

## Goals and constraints

This is a **family** planning tool, which drove three decisions:

1. **Privacy first.** Household income, debts, and balances are sensitive.
   The app is 100% client-side — no backend, no accounts, no telemetry. Data
   persists in the browser's localStorage and can be exported/imported as a
   JSON file.
2. **Instant feedback.** What-if exploration only works if the loop is tight.
   The simulation is a pure function that runs in a few milliseconds for a
   30-year horizon, so results recompute live on every parameter change — no
   "Run" button needed.
3. **Deterministic and inspectable.** The engine models averages (expected
   yield, CPI, growth) rather than stochastic paths. That keeps results
   explainable at the kitchen table: change one number, see one effect.
   (Monte Carlo is a natural future extension — see below.)

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | The domain model (plans, events, snapshots) benefits heavily from types; refactoring safety for a growing tool. |
| UI | React 18 + Vite | Ubiquitous, fast dev server, trivial static deployment (any static host: GitHub Pages, Netlify…). |
| Charts | Recharts | Declarative, composable, handles responsive SVG charts with tooltips/legends out of the box. |
| State | React `useState` + localStorage | The entire app state is one serializable `Plan` object. No Redux/Zustand needed at this size; persistence is a one-line effect. |
| Simulation | Pure TypeScript module (`src/engine/`) | Framework-free and fully unit-testable; could be moved to a Web Worker or reused in a CLI/server later without changes. |
| Tests | Vitest | Zero-config with Vite; the engine has a full behavioral test suite. |

There is intentionally **no backend and no database**. A future
multi-device sync could add one, but the export/import JSON flow covers the
MVP need without any of the security burden of hosting financial data.

## Architecture overview

```
┌────────────────────────────────────────────────────────┐
│  UI (React)                                            │
│  App.tsx — owns the Plan state, persists to storage    │
│  ├── HouseholdTab   income sources, taxes, ages, kids  │
│  ├── BudgetTab      categorized monthly budget         │
│  ├── AssetsTab      assets + amortizing liabilities    │
│  ├── ScenarioTab    horizon, what-ifs, scripted events │
│  └── ResultsTab     charts, insights, yearly table     │
└──────────────┬─────────────────────────────────────────┘
               │  Plan (single serializable object)
               ▼
┌────────────────────────────────────────────────────────┐
│  Engine (pure TypeScript, no React imports)            │
│  simulate(plan) ──► SimulationResult                   │
│    monthly snapshots, debt payoffs, deficit flags      │
│  analyze(plan, result) ──► Analysis                    │
│    sustainability, retirement, blind spots,            │
│    category opportunities, income ideas                │
└──────────────┬─────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────┐
│  Persistence (src/storage.ts)                          │
│  localStorage (auto-save on every change)              │
│  JSON export / import for backup & device transfer     │
└────────────────────────────────────────────────────────┘
```

### The `Plan` document

Everything the user enters lives in one versioned, serializable object
(`src/types.ts`):

- `household` — a household type (`single`/`couple`), income sources (each
  with its own growth rate), a blended effective tax rate, the primary (and,
  for couples, partner) age, retirement target, and dependents. Each dependent
  has a `kind` (`child`/`other`) so the college-savings check applies only to
  children. The default plan is seeded from generic U.S. national averages so
  it reflects no real person's finances.
- `budget` — categories with a `kind` that determines simulation behavior:
  - `expense`: money out; optionally CPI-indexed; flagged essential or
    discretionary (drives the opportunity analysis).
  - `contribution`: transferred into a linked asset (401k, savings, 529).
  - `debtPayment`: extra principal toward a linked liability.
- `assets` — one shape, four kinds (`cash`/`investment`/`property`/`vehicle`);
  a single `annualRate` field means APY, expected yield, appreciation, or
  depreciation depending on kind.
- `liabilities` — remaining principal, APR, required monthly payment, and an
  optional link to the securing asset (house, car) for equity reporting.
- `scenario` — horizon, CPI, market-return adjustment, income growth
  override, and the scripted events list.

The `version` field allows future schema migrations of stored plans.

### The simulation engine (`src/engine/simulate.ts`)

A discrete-time simulation with **monthly steps**. Order of operations each
month (documented in the source):

1. **Income** — per-source gross with compounded growth; job-loss events zero
   a source for their window; new-income events add (optionally taxable)
   streams; the effective tax rate converts to net.
2. **Refinance events** — restructure a liability (rate, payment, closing
   costs rolled into principal) from their month onward.
3. **Debt service** — interest accrues on each balance; the required payment
   plus any `debtPayment` category extras are applied (never more than the
   remaining balance); payoff month and cumulative interest are recorded.
4. **Expenses** — CPI-indexed where flagged; expense-change events override a
   category's amount from their month.
5. **Contributions** — moved into linked assets (they reduce surplus but not
   net worth).
6. **One-time events** — windfalls credit cash; one-time expenses count as
   that month's expenses.
7. **Asset growth** — every asset compounds monthly at its annual rate;
   vehicles floor at zero.
8. **Cash settlement** — the month's surplus (or deficit) lands in the first
   cash account. Negative cash is allowed but flagged as a "cash crunch" —
   the tool's most important warning.

Each month emits a `MonthSnapshot` (net worth, cash, investments, per-debt
balances, per-category spend, home equity…), which the Results tab consumes
directly.

**Why monthly?** Debt amortization, budgets, and paychecks are all monthly
concepts; annual steps would misstate interest and payoff timing, while daily
steps add cost without planning value.

### The insights layer (`src/engine/insights.ts`)

Pure functions from `(Plan, SimulationResult)` to human-readable findings,
one section per family question:

- **Sustainability** — surplus/deficit, average savings rate vs. the 15%
  guideline, first cash-crunch month, net-worth delta over the horizon.
- **Retirement** — simulated investment balances extended to retirement age
  at the blended return with current contributions, then compared via the 4%
  rule against today's expenses inflated to retirement.
- **Blind spots** — emergency-fund months vs. 3–6 guideline, college savings
  detection per dependent, retirement contribution rate vs. 15% of gross,
  insurance presence.
- **Opportunities** — discretionary categories ranked by size, each with the
  future value of redirecting a 25% cut into investments.
- **Income ideas** — heuristics parameterized by the user's numbers (e.g.
  rental down-payment feasibility from liquid cash), each phrased as a
  testable scripted event.

Insights are deliberately **guideline-based heuristics with the guideline
named in the text**, so users can disagree with a rule and still trust the
arithmetic.

### Charts

Recharts line/bar charts using a validated 8-slot categorical palette with
light and dark variants (`src/components/palette.ts`); the palette passes
colorblind-separation and contrast checks in both modes. Colors are assigned
to series in fixed slot order. Every multi-series chart has a legend and
hover tooltips, and the year-by-year table provides a non-color reading of
the same data. The UI follows `prefers-color-scheme` for dark mode via CSS
custom properties; chart colors switch through a `matchMedia` hook because
SVG presentation attributes can't resolve CSS variables.

## Simplifications (known model limits)

- **Taxes**: one blended effective rate; no brackets, deductions, or
  pre-tax/post-tax contribution distinction.
- **Returns**: deterministic averages; no volatility or
  sequence-of-returns risk.
- **Retirement projection**: excludes Social Security, pensions, and employer
  match (noted in the UI); assumes contribution amounts stay flat beyond the
  simulated horizon.
- **Debt**: fixed-rate amortization only; no variable-rate loans or escrow.

## Future extensions

- **Scenario comparison** — run and overlay 2–3 named scenarios on one chart.
- **Monte Carlo mode** — sample return/inflation paths for percentile bands;
  the pure-function engine makes this a loop + a Web Worker.
- **Employer match & pre-tax contributions** — more faithful retirement math.
- **Goal tracking** — explicit college/house/emergency targets with progress.
- **Amortization schedule export** — per-debt CSV.
