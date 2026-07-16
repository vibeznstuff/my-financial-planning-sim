# Family Financial Planning Simulator

A private, browser-based tool for planning your household's financial future.
Enter your income, monthly budget, assets, and debts — then simulate years
ahead under different what-if scenarios: job loss, refinancing, new income
streams, inflation swings, market downturns, and deliberate spending changes.

**All data stays in your browser** (localStorage). Nothing is uploaded
anywhere. Plans can be exported/imported as JSON files for backup or sharing
between devices.

## What it answers

The tool is built around five family planning questions:

1. **Is our current spending behavior sustainable?** — monthly surplus/deficit,
   savings rate vs. guidelines, projected cash crunches, net-worth trajectory.
2. **How will we be set up for retirement at this pace?** — investment balances
   projected to your target retirement age, checked against the 4% rule and
   your inflation-adjusted spending need.
3. **Which spending categories offer the most opportunity?** — discretionary
   categories ranked by size, with the compounded value of redirecting a cut
   into investments.
4. **Where are our blind spots?** — emergency-fund coverage, college savings
   for dependents, retirement contribution rate, missing insurance.
5. **What supplemental income is viable?** — ideas parameterized with your
   actual numbers (rental property down payment feasibility, side income,
   idle-cash yield), each testable as a scripted simulation event.

## Features

- **Household & income** — two-spouse income sources (add more), per-source
  growth rates, blended effective tax rate, ages and retirement target,
  dependents.
- **Monthly budget** — categorized spending (groceries, eating out,
  subscriptions, insurance…) with three category types:
  - *Expense* — money leaving the household, optionally CPI-adjusted
  - *Contribution* — money moved into a linked account (401k, savings, 529…)
  - *Extra debt payment* — principal on top of a loan's required payment
- **Assets & debts** — cash accounts with APY, investment accounts with
  expected yield, property with appreciation, vehicles with depreciation;
  loans with true monthly amortization (rate, payment, remaining principal)
  and equity tracking for secured debts.
- **Scenario & what-ifs** — parameterized horizon (1–30 years), CPI
  assumption, market return adjustment (test a bear market), income growth
  override, and scripted events:
  - Lose a job at month X for Y months
  - Gain new income (rental, business, raise) starting at month Z
  - One-time expenses and windfalls
  - Refinance any debt (new rate/payment, closing costs)
  - Change an expense category from a given month
- **Results** — net worth / cash flow / debt payoff charts, budget breakdown,
  debt payoff dates with total interest paid, year-by-year table, and the
  five insight panels above. Everything recomputes instantly on any change.

## Getting started

```bash
npm install
npm run dev        # start the app at http://localhost:5173
```

Other commands:

```bash
npm test           # run the simulation engine test suite
npm run build      # production build to dist/
npm run preview    # serve the production build
```

The app opens with a realistic sample plan so every screen is populated —
replace the numbers with your own, or hit **Reset** to get the sample back.
Use **Export plan** to save your data as JSON and **Import plan** to restore it.

## How the simulation works

The engine steps month by month over the chosen horizon. Each month it:

1. Computes gross income per source (growth compounding, job-loss and
   new-income events), then applies the effective tax rate.
2. Applies refinance events, then services each debt: interest accrues on the
   balance, required + extra payments are applied, payoff months are recorded.
3. Applies budget expenses (CPI-adjusted where flagged, expense-change events).
4. Moves contributions into their linked accounts.
5. Applies one-time expenses / windfalls.
6. Grows every asset at its own rate (yield, APY, appreciation, depreciation).
7. Settles the remaining surplus (or deficit) into the default cash account.

See [docs/architecture.md](docs/architecture.md) for the full design and tech
stack rationale.

## Disclaimers

This is a planning aid, not financial advice. The model is deliberately
simplified: a single blended effective tax rate, deterministic average
returns (no volatility/sequence-of-returns risk), and guideline-based
heuristics (4% rule, 15% retirement contribution, 3–6 month emergency fund).
Validate big decisions with a professional.
