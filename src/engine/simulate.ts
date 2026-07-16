import type {
  Plan,
  MonthSnapshot,
  SimulationResult,
  DebtPayoff,
  ScriptedEvent,
} from "../types";

/** Convert an annual percentage rate to a monthly multiplier (compounded monthly). */
export function monthlyRate(annualPct: number): number {
  return annualPct / 100 / 12;
}

/** Grow a value at an annual % rate for one month (geometric, handles negatives). */
export function growOneMonth(value: number, annualPct: number): number {
  return value * Math.pow(1 + annualPct / 100, 1 / 12);
}

interface DebtState {
  id: string;
  name: string;
  balance: number;
  annualRate: number;
  monthlyPayment: number;
  securedAssetId?: string;
  interestPaid: number;
  paidOffMonth: number | null;
}

interface AssetState {
  id: string;
  kind: string;
  value: number;
  annualRate: number;
}

function eventsOfType<T extends ScriptedEvent["type"]>(
  events: ScriptedEvent[],
  type: T,
): Extract<ScriptedEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<
    ScriptedEvent,
    { type: T }
  >[];
}

/**
 * Run the plan month-by-month over the scenario horizon.
 *
 * Order of operations each month:
 *  1. Income (growth, job-loss and new-income events, taxes)
 *  2. Refinance events restructure debts
 *  3. Debt service: interest accrues, required + extra payments applied
 *  4. Budget expenses (CPI-adjusted where flagged, expense-change events)
 *  5. Contributions moved into linked assets
 *  6. One-time expenses / windfalls hit the cash account
 *  7. Asset growth (yield / APY / appreciation / depreciation)
 *  8. Surplus or deficit settles into the default cash account
 */
export function simulate(plan: Plan): SimulationResult {
  const { household, budget, assets, liabilities, scenario } = plan;
  const totalMonths = Math.max(1, Math.round(scenario.horizonYears * 12));
  const taxRate = household.effectiveTaxRate / 100;

  const jobLosses = eventsOfType(scenario.events, "jobLoss");
  const newIncomes = eventsOfType(scenario.events, "newIncome");
  const oneTimeExpenses = eventsOfType(scenario.events, "oneTimeExpense");
  const windfalls = eventsOfType(scenario.events, "windfall");
  const refinances = eventsOfType(scenario.events, "refinance");
  const expenseChanges = eventsOfType(scenario.events, "expenseChange");

  const assetStates: AssetState[] = assets.map((a) => ({
    id: a.id,
    kind: a.kind,
    value: a.value,
    annualRate:
      a.kind === "investment"
        ? a.annualRate + scenario.marketReturnAdjustment
        : a.annualRate,
  }));

  const debtStates: DebtState[] = liabilities.map((l) => ({
    id: l.id,
    name: l.name,
    balance: l.principal,
    annualRate: l.annualInterestRate,
    monthlyPayment: l.monthlyPayment,
    securedAssetId: l.securedAssetId,
    interestPaid: 0,
    paidOffMonth: null,
  }));

  // Deficits and surpluses settle into the first cash account; if none exists,
  // track a virtual one so the simulation still balances.
  let defaultCash = assetStates.find((a) => a.kind === "cash");
  if (!defaultCash) {
    defaultCash = { id: "__virtual-cash__", kind: "cash", value: 0, annualRate: 0 };
    assetStates.push(defaultCash);
  }

  const startNetWorth =
    assetStates.reduce((s, a) => s + a.value, 0) -
    debtStates.reduce((s, d) => s + d.balance, 0);

  const months: MonthSnapshot[] = [];
  let deficitMonths = 0;
  let firstCashCrunchMonth: number | null = null;
  let savingsRateSum = 0;
  let savingsRateCount = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const yearsElapsed = (m - 1) / 12;

    // -- 1. Income ----------------------------------------------------------
    let grossIncome = 0;
    for (const src of household.incomeSources) {
      const lostThisMonth = jobLosses.some(
        (e) =>
          e.incomeSourceId === src.id &&
          m >= e.startMonth &&
          m < e.startMonth + e.durationMonths,
      );
      if (lostThisMonth) continue;
      const growth =
        scenario.incomeGrowthOverride ?? src.annualGrowthRate;
      grossIncome +=
        (src.annualGross / 12) * Math.pow(1 + growth / 100, yearsElapsed);
    }

    let taxableGross = grossIncome;
    let untaxedIncome = 0;
    for (const e of newIncomes) {
      if (m < e.startMonth) continue;
      const yrs = (m - e.startMonth) / 12;
      const amt = e.monthlyAmount * Math.pow(1 + e.annualGrowthRate / 100, yrs);
      if (e.taxable) taxableGross += amt;
      else untaxedIncome += amt;
      grossIncome += amt;
    }
    const netIncome = taxableGross * (1 - taxRate) + untaxedIncome;

    // -- 2. Refinance events ------------------------------------------------
    for (const e of refinances) {
      if (e.month !== m) continue;
      const debt = debtStates.find((d) => d.id === e.liabilityId);
      if (!debt || debt.balance <= 0) continue;
      debt.balance += e.closingCosts;
      debt.annualRate = e.newAnnualInterestRate;
      debt.monthlyPayment = e.newMonthlyPayment;
    }

    // -- 3. Debt service ----------------------------------------------------
    // Extra payments from "debtPayment" budget categories, keyed by liability.
    const extraByDebt = new Map<string, number>();
    const categorySpend: Record<string, number> = {};
    const activeAmount = (catId: string, base: number): number => {
      let amt = base;
      for (const e of expenseChanges) {
        if (e.categoryId === catId && m >= e.month) amt = e.newMonthlyAmount;
      }
      return amt;
    };

    for (const cat of budget) {
      if (cat.kind !== "debtPayment" || !cat.linkedId) continue;
      const amt = activeAmount(cat.id, cat.monthlyAmount);
      extraByDebt.set(cat.linkedId, (extraByDebt.get(cat.linkedId) ?? 0) + amt);
      categorySpend[cat.id] = 0; // filled in below with what was actually applied
    }

    let totalDebtPayments = 0;
    for (const debt of debtStates) {
      if (debt.balance <= 0) continue;
      const interest = debt.balance * monthlyRate(debt.annualRate);
      debt.balance += interest;
      debt.interestPaid += interest;

      const extra = extraByDebt.get(debt.id) ?? 0;
      const payment = Math.min(debt.monthlyPayment + extra, debt.balance);
      debt.balance -= payment;
      totalDebtPayments += payment;

      // Attribute the extra portion back to its budget category for reporting.
      if (extra > 0) {
        const applied = Math.max(0, payment - debt.monthlyPayment);
        for (const cat of budget) {
          if (cat.kind === "debtPayment" && cat.linkedId === debt.id) {
            categorySpend[cat.id] =
              (categorySpend[cat.id] ?? 0) +
              Math.min(applied, activeAmount(cat.id, cat.monthlyAmount));
          }
        }
      }
      if (debt.balance <= 0.005 && debt.paidOffMonth === null) {
        debt.balance = 0;
        debt.paidOffMonth = m;
      }
    }

    // -- 4. Budget expenses --------------------------------------------------
    const cpiFactor = Math.pow(1 + scenario.inflationRate / 100, yearsElapsed);
    let totalExpenses = 0;
    for (const cat of budget) {
      if (cat.kind !== "expense") continue;
      let amt = activeAmount(cat.id, cat.monthlyAmount);
      if (cat.inflationAdjusted) amt *= cpiFactor;
      categorySpend[cat.id] = amt;
      totalExpenses += amt;
    }

    // -- 5. Contributions ----------------------------------------------------
    let totalContributions = 0;
    for (const cat of budget) {
      if (cat.kind !== "contribution") continue;
      const amt = activeAmount(cat.id, cat.monthlyAmount);
      categorySpend[cat.id] = amt;
      totalContributions += amt;
      const target = assetStates.find((a) => a.id === cat.linkedId);
      (target ?? defaultCash).value += amt;
    }

    // -- 6. One-time events --------------------------------------------------
    for (const e of oneTimeExpenses) {
      // Counted in totalExpenses; the surplus settlement below moves the cash.
      if (e.month === m) totalExpenses += e.amount;
    }
    for (const e of windfalls) {
      if (e.month === m) defaultCash.value += e.amount;
    }

    // -- 7. Asset growth -----------------------------------------------------
    for (const a of assetStates) {
      a.value = growOneMonth(a.value, a.annualRate);
      if (a.kind === "vehicle" && a.value < 0) a.value = 0;
    }

    // -- 8. Settle cash flow -------------------------------------------------
    const surplus =
      netIncome - totalExpenses - totalDebtPayments - totalContributions;
    defaultCash.value += surplus;

    if (surplus < 0) deficitMonths++;
    if (defaultCash.value < 0 && firstCashCrunchMonth === null) {
      firstCashCrunchMonth = m;
    }
    if (netIncome > 0) {
      savingsRateSum += (totalContributions + Math.max(0, surplus)) / netIncome;
      savingsRateCount++;
    }

    // -- Snapshot -------------------------------------------------------------
    const sumKind = (kind: string) =>
      assetStates
        .filter((a) => a.kind === kind)
        .reduce((s, a) => s + a.value, 0);
    const totalAssets = assetStates.reduce((s, a) => s + a.value, 0);
    const totalDebt = debtStates.reduce((s, d) => s + d.balance, 0);
    const debtBalances: Record<string, number> = {};
    for (const d of debtStates) debtBalances[d.id] = d.balance;

    let homeEquity = 0;
    for (const d of debtStates) {
      if (!d.securedAssetId) continue;
      const secured = assetStates.find((a) => a.id === d.securedAssetId);
      if (secured) homeEquity += secured.value - d.balance;
    }

    const yr = Math.floor((m - 1) / 12) + 1;
    const mo = ((m - 1) % 12) + 1;
    months.push({
      month: m,
      label: `Yr ${yr} · Mo ${mo}`,
      grossIncome,
      netIncome,
      totalExpenses,
      totalContributions,
      totalDebtPayments,
      surplus,
      cash: sumKind("cash"),
      investments: sumKind("investment"),
      propertyValue: sumKind("property"),
      vehicleValue: sumKind("vehicle"),
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      homeEquity,
      debtBalances,
      categorySpend,
    });
  }

  const payoffs: DebtPayoff[] = debtStates
    .filter((d) => d.paidOffMonth !== null)
    .map((d) => ({
      liabilityId: d.id,
      name: d.name,
      month: d.paidOffMonth as number,
      totalInterestPaid: d.interestPaid,
    }));

  return {
    months,
    payoffs,
    deficitMonths,
    firstCashCrunchMonth,
    endNetWorth: months[months.length - 1].netWorth,
    startNetWorth,
    averageSavingsRate: savingsRateCount ? savingsRateSum / savingsRateCount : 0,
  };
}
