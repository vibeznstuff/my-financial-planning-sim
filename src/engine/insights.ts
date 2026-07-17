import type { Plan, SimulationResult } from "../types";
import { simulate } from "./simulate";

export type InsightStatus = "good" | "warning" | "serious" | "critical";

export interface Insight {
  status: InsightStatus;
  title: string;
  detail: string;
}

export interface CategoryOpportunity {
  categoryId: string;
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  /** Net-worth impact at horizon if this category were cut 25% and redirected to investments. */
  horizonImpactOfQuarterCut: number;
}

export interface IncomeIdea {
  title: string;
  detail: string;
}

export interface Analysis {
  sustainability: Insight[];
  retirement: Insight[];
  blindSpots: Insight[];
  opportunities: CategoryOpportunity[];
  incomeIdeas: IncomeIdea[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function monthLabel(m: number): string {
  const yr = Math.floor((m - 1) / 12) + 1;
  const mo = ((m - 1) % 12) + 1;
  return `year ${yr}, month ${mo}`;
}

// ---------------------------------------------------------------------------
// 1. Is our current spending behavior sustainable?
// ---------------------------------------------------------------------------
function sustainability(plan: Plan, result: SimulationResult): Insight[] {
  const out: Insight[] = [];
  const first = result.months[0];
  const monthlyOut =
    first.totalExpenses + first.totalDebtPayments + first.totalContributions;

  if (first.surplus >= 0) {
    out.push({
      status: "good",
      title: `You run a monthly surplus of ${fmt(first.surplus)}`,
      detail: `Net income ${fmt(first.netIncome)}/mo vs. ${fmt(monthlyOut)}/mo going out. Unallocated surplus accumulates in your cash account in the simulation — consider directing it somewhere deliberate.`,
    });
  } else {
    out.push({
      status: "critical",
      title: `You are overspending by ${fmt(-first.surplus)} per month`,
      detail: `Net income ${fmt(first.netIncome)}/mo vs. ${fmt(monthlyOut)}/mo going out. At this pace the shortfall drains cash reserves.`,
    });
  }

  out.push({
    status:
      result.averageSavingsRate >= 0.15
        ? "good"
        : result.averageSavingsRate >= 0.08
          ? "warning"
          : "serious",
    title: `Average savings rate over the horizon: ${pct(result.averageSavingsRate)}`,
    detail:
      "Savings rate = (contributions + surplus) / net income. A common guideline is 15%+ of net income for households targeting a conventional retirement age.",
  });

  if (result.firstCashCrunchMonth !== null) {
    out.push({
      status: "critical",
      title: `Cash goes negative in ${monthLabel(result.firstCashCrunchMonth)}`,
      detail: `The simulation projects your cash accounts are exhausted at that point (${result.deficitMonths} deficit months over the horizon). Spending must come down, income up, or assets liquidated before then.`,
    });
  } else if (result.deficitMonths > 0) {
    out.push({
      status: "warning",
      title: `${result.deficitMonths} deficit month(s) over the horizon`,
      detail:
        "Cash reserves absorb them in this scenario, but repeated deficits erode your buffer.",
    });
  }

  const growth = result.endNetWorth - result.startNetWorth;
  out.push({
    status: growth > 0 ? "good" : "critical",
    title: `Net worth ${growth >= 0 ? "grows" : "shrinks"} ${fmt(Math.abs(growth))} over ${plan.scenario.horizonYears} years`,
    detail: `From ${fmt(result.startNetWorth)} today to ${fmt(result.endNetWorth)} at the horizon under this scenario's assumptions.`,
  });

  return out;
}

// ---------------------------------------------------------------------------
// 2. How will we be set up for retirement at this pace?
// ---------------------------------------------------------------------------
function retirement(plan: Plan, result: SimulationResult): Insight[] {
  const { household, scenario, budget, assets } = plan;
  const out: Insight[] = [];

  // Retirement is planned around the older adult when there are two.
  const ages =
    household.householdType === "couple" && household.partnerAge != null
      ? [household.primaryAge, household.partnerAge]
      : [household.primaryAge];
  const olderAge = Math.max(...ages);
  const yearsToRetirement = Math.max(0, household.targetRetirementAge - olderAge);

  // Project investment balances to retirement: use simulated end state, then
  // extend at the same contribution pace and blended return if the horizon is
  // shorter than the runway to retirement.
  const horizonYears = scenario.horizonYears;
  const endInvestments = result.months[result.months.length - 1].investments;
  const investmentAssets = assets.filter((a) => a.kind === "investment");
  const blendedReturn =
    investmentAssets.length > 0
      ? investmentAssets.reduce((s, a) => s + a.annualRate, 0) /
          investmentAssets.length +
        scenario.marketReturnAdjustment
      : 6;

  const monthlyContrib = budget
    .filter(
      (c) =>
        c.kind === "contribution" &&
        investmentAssets.some((a) => a.id === c.linkedId),
    )
    .reduce((s, c) => s + c.monthlyAmount, 0);

  let projected = endInvestments;
  const extraYears = Math.max(0, yearsToRetirement - horizonYears);
  const r = blendedReturn / 100 / 12;
  for (let i = 0; i < extraYears * 12; i++) {
    projected = projected * (1 + r) + monthlyContrib;
  }

  // Spending need at retirement: today's expenses inflated, minus debt
  // payments that will have ended by then.
  const first = result.months[0];
  const inflated =
    (first.totalExpenses) *
    Math.pow(1 + scenario.inflationRate / 100, yearsToRetirement);
  const annualNeed = inflated * 12;
  const safeWithdrawal = projected * 0.04;

  out.push({
    status: "good",
    title: `Projected investment balance at retirement (age ${household.targetRetirementAge}): ${fmt(projected)}`,
    detail: `Simulated to year ${horizonYears}, then extended ${extraYears.toFixed(0)} more years at ${blendedReturn.toFixed(1)}%/yr with ${fmt(monthlyContrib)}/mo contributions.`,
  });

  const coverage = annualNeed > 0 ? safeWithdrawal / annualNeed : 1;
  out.push({
    status: coverage >= 1 ? "good" : coverage >= 0.7 ? "warning" : "serious",
    title: `4% rule covers ${pct(coverage)} of projected retirement spending`,
    detail: `A 4% initial withdrawal gives ${fmt(safeWithdrawal)}/yr against an estimated need of ${fmt(annualNeed)}/yr (today's expenses inflated ${yearsToRetirement.toFixed(0)} years at ${scenario.inflationRate}% CPI; excludes Social Security and pensions, so treat as conservative).`,
  });

  return out;
}

// ---------------------------------------------------------------------------
// 3. Which categories offer the most opportunity to scale back?
// ---------------------------------------------------------------------------
function opportunities(plan: Plan): CategoryOpportunity[] {
  const { budget, scenario } = plan;
  const discretionary = budget.filter(
    (c) => c.kind === "expense" && !c.essential && c.monthlyAmount > 0,
  );

  // Value at horizon of redirecting 25% of the category into investments.
  const rate = (6 + scenario.marketReturnAdjustment) / 100 / 12;
  const n = scenario.horizonYears * 12;
  const fvFactor = rate > 0 ? (Math.pow(1 + rate, n) - 1) / rate : n;

  return discretionary
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      monthlyAmount: c.monthlyAmount,
      annualAmount: c.monthlyAmount * 12,
      horizonImpactOfQuarterCut: c.monthlyAmount * 0.25 * fvFactor,
    }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

// ---------------------------------------------------------------------------
// 4. Where are the blind spots?
// ---------------------------------------------------------------------------
function blindSpots(plan: Plan, result: SimulationResult): Insight[] {
  const { household, budget, assets } = plan;
  const out: Insight[] = [];
  const first = result.months[0];

  // Emergency fund: liquid cash vs. months of essential spend + debt service.
  const liquidCash = assets
    .filter((a) => a.kind === "cash")
    .reduce((s, a) => s + a.value, 0);
  const essentialMonthly =
    budget
      .filter((c) => c.kind === "expense" && c.essential)
      .reduce((s, c) => s + c.monthlyAmount, 0) + first.totalDebtPayments;
  const monthsCovered = essentialMonthly > 0 ? liquidCash / essentialMonthly : 99;
  out.push({
    status: monthsCovered >= 6 ? "good" : monthsCovered >= 3 ? "warning" : "critical",
    title: `Emergency fund covers ${monthsCovered.toFixed(1)} months of essentials`,
    detail: `${fmt(liquidCash)} liquid vs. ${fmt(essentialMonthly)}/mo of essential expenses and debt payments. The common guideline is 3–6 months; ${
      household.householdType === "couple"
        ? "two-income households can lean toward 3–4, since both jobs rarely end at once."
        : "single-income households should lean toward the higher end (6+), since there's no second paycheck to fall back on."
    }`,
  });

  // College savings — only for child dependents who haven't reached 18 yet.
  for (const dep of household.dependents) {
    if (dep.kind === "other") continue;
    const yearsToCollege = Math.max(0, 18 - dep.age);
    const has529 = budget.some(
      (c) =>
        c.kind === "contribution" &&
        /529|college|education/i.test(
          c.name + (assets.find((a) => a.id === c.linkedId)?.name ?? ""),
        ),
    );
    if (!has529 && yearsToCollege > 0) {
      out.push({
        status: yearsToCollege < 8 ? "serious" : "warning",
        title: `No college savings detected for ${dep.name} (${yearsToCollege} years to 18)`,
        detail:
          "No budget category or account looks like a 529/college fund. Even $100–300/mo started early compounds meaningfully by college age.",
      });
    }
  }

  // Retirement contribution rate vs. 15% of gross guideline.
  const grossMonthly = household.incomeSources.reduce(
    (s, x) => s + x.annualGross / 12,
    0,
  );
  const retirementContrib = budget
    .filter(
      (c) =>
        c.kind === "contribution" &&
        /401|403|ira|retire|invest/i.test(
          c.name + (assets.find((a) => a.id === c.linkedId)?.name ?? ""),
        ),
    )
    .reduce((s, c) => s + c.monthlyAmount, 0);
  const contribRate = grossMonthly > 0 ? retirementContrib / grossMonthly : 0;
  out.push({
    status: contribRate >= 0.15 ? "good" : contribRate >= 0.1 ? "warning" : "serious",
    title: `Retirement contributions are ${pct(contribRate)} of gross income`,
    detail: `${fmt(retirementContrib)}/mo toward retirement/investment accounts vs. the common 15%-of-gross guideline (${fmt(grossMonthly * 0.15)}/mo). Employer match, if any, counts toward this and isn't modeled here.`,
  });

  // Insurance presence.
  const hasInsurance = budget.some(
    (c) => c.kind === "expense" && /insur|term life/i.test(c.name),
  );
  if (!hasInsurance) {
    out.push({
      status: "warning",
      title: "No insurance category found in the budget",
      detail:
        "A household with dependents typically carries term life and disability coverage; neither appears in your budget.",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 5. Supplemental income ideas, parameterized with the household's numbers
// ---------------------------------------------------------------------------
function incomeIdeas(plan: Plan, result: SimulationResult): IncomeIdea[] {
  const liquid = plan.assets
    .filter((a) => a.kind === "cash")
    .reduce((s, a) => s + a.value, 0);
  const first = result.months[0];
  const ideas: IncomeIdea[] = [];

  const downPayment = Math.floor((liquid * 0.6) / 5000) * 5000;
  if (downPayment >= 20000) {
    ideas.push({
      title: "Rental property",
      detail: `Roughly ${fmt(downPayment)} of your cash could serve as a 20–25% down payment on a ${fmt(downPayment * 4)}–${fmt(downPayment * 5)} property. Model it here: add a "newIncome" event for the net rent and a new mortgage liability, and compare scenarios. Rule of thumb: target rent ≥ 1% of purchase price per month before committing.`,
    });
  } else {
    ideas.push({
      title: "Rental property (not yet)",
      detail: `Your liquid cash (${fmt(liquid)}) is below a comfortable down payment plus reserves for most markets. Consider REITs or fractional real-estate exposure through your investment accounts in the meantime.`,
    });
  }

  ideas.push({
    title: "Side business / freelancing",
    detail: `An extra ${fmt(500)}/mo of untaxed-in-this-model profit adds ~${fmt(500 * 12 * plan.scenario.horizonYears)} over the horizon before compounding. Test it with a "New income" scripted event to see the effect on your net-worth curve.`,
  });

  if (first.surplus > 300) {
    ideas.push({
      title: "Put the idle surplus to work",
      detail: `Your ${fmt(first.surplus)}/mo unallocated surplus currently pools in cash. Redirecting it to investments at market rates is the lowest-effort "supplemental income" available to you — add a contribution category and re-run.`,
    });
  }

  ideas.push({
    title: "High-yield cash",
    detail: plan.assets.some((a) => a.kind === "cash" && a.annualRate >= 3.5)
      ? "Your cash already earns a competitive APY — nice."
      : `Cash earning under ~3.5% APY leaves yield on the table; moving ${fmt(liquid)} to a high-yield account at 4% adds ~${fmt(liquid * 0.04)}/yr risk-free.`,
  });

  return ideas;
}

export function analyze(plan: Plan, result: SimulationResult): Analysis {
  return {
    sustainability: sustainability(plan, result),
    retirement: retirement(plan, result),
    blindSpots: blindSpots(plan, result),
    opportunities: opportunities(plan),
    incomeIdeas: incomeIdeas(plan, result),
  };
}

/** Re-run the simulation with one category reduced — used for quick what-if deltas. */
export function simulateWithCategoryCut(
  plan: Plan,
  categoryId: string,
  fraction: number,
): SimulationResult {
  const clone: Plan = JSON.parse(JSON.stringify(plan));
  const cat = clone.budget.find((c) => c.id === categoryId);
  if (cat) cat.monthlyAmount *= 1 - fraction;
  return simulate(clone);
}
