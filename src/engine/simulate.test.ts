import { describe, it, expect } from "vitest";
import { simulate, growOneMonth } from "./simulate";
import { defaultPlan } from "../defaults";
import type { Plan } from "../types";

/** Minimal plan: one income, one expense, one cash account, nothing else. */
function minimalPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    version: 1,
    household: {
      incomeSources: [
        { id: "inc1", name: "Job", annualGross: 120000, annualGrowthRate: 0 },
      ],
      effectiveTaxRate: 25,
      householdType: "couple",
      primaryAge: 35,
      partnerAge: 35,
      targetRetirementAge: 65,
      dependents: [],
    },
    budget: [
      {
        id: "cat1",
        name: "Living",
        kind: "expense",
        monthlyAmount: 5000,
        inflationAdjusted: false,
        essential: true,
      },
    ],
    assets: [{ id: "cash1", name: "Checking", kind: "cash", value: 10000, annualRate: 0 }],
    liabilities: [],
    scenario: {
      name: "test",
      horizonYears: 1,
      inflationRate: 0,
      marketReturnAdjustment: 0,
      incomeGrowthOverride: null,
      events: [],
    },
    ...overrides,
  };
}

describe("simulate — cash flow basics", () => {
  it("accumulates monthly surplus into cash", () => {
    const result = simulate(minimalPlan());
    // Net income: 120000/12 * 0.75 = 7500. Expenses 5000. Surplus 2500/mo.
    expect(result.months[0].surplus).toBeCloseTo(2500, 5);
    expect(result.months[0].cash).toBeCloseTo(12500, 5);
    expect(result.months[11].cash).toBeCloseTo(10000 + 2500 * 12, 5);
    expect(result.deficitMonths).toBe(0);
  });

  it("flags deficits and cash crunches", () => {
    const plan = minimalPlan();
    plan.budget[0].monthlyAmount = 9000; // 1500/mo deficit vs 7500 net
    const result = simulate(plan);
    expect(result.deficitMonths).toBe(12);
    // 10000 buffer / 1500 per month => negative in month 7
    expect(result.firstCashCrunchMonth).toBe(7);
  });

  it("applies CPI to inflation-adjusted expenses only", () => {
    const plan = minimalPlan();
    plan.budget[0].inflationAdjusted = true;
    plan.scenario.inflationRate = 10;
    plan.scenario.horizonYears = 2;
    const result = simulate(plan);
    const m13 = result.months[12]; // one full year elapsed
    expect(m13.totalExpenses).toBeCloseTo(5000 * 1.1, 2);
  });
});

describe("simulate — debt amortization", () => {
  it("amortizes a loan and records payoff month and interest", () => {
    const plan = minimalPlan();
    plan.scenario.horizonYears = 3;
    plan.liabilities = [
      {
        id: "loan1",
        name: "Loan",
        principal: 10000,
        annualInterestRate: 12,
        monthlyPayment: 500,
      },
    ];
    const result = simulate(plan);
    // 10k at 1%/mo with $500 payments pays off in ~23 months.
    const payoff = result.payoffs.find((p) => p.liabilityId === "loan1");
    expect(payoff).toBeDefined();
    expect(payoff!.month).toBe(23);
    expect(payoff!.totalInterestPaid).toBeGreaterThan(1000);
    expect(payoff!.totalInterestPaid).toBeLessThan(1400);
    // Final payment is only the remaining balance, never more.
    const last = result.months[payoff!.month - 1];
    expect(last.debtBalances["loan1"]).toBe(0);
  });

  it("extra debtPayment categories accelerate payoff", () => {
    const base = minimalPlan();
    base.scenario.horizonYears = 3;
    base.liabilities = [
      { id: "loan1", name: "Loan", principal: 10000, annualInterestRate: 12, monthlyPayment: 500 },
    ];
    const slow = simulate(base);

    const fast = JSON.parse(JSON.stringify(base)) as Plan;
    fast.budget.push({
      id: "extra",
      name: "Extra payment",
      kind: "debtPayment",
      monthlyAmount: 250,
      inflationAdjusted: false,
      essential: false,
      linkedId: "loan1",
    });
    const result = simulate(fast);
    expect(result.payoffs[0].month).toBeLessThan(slow.payoffs[0].month);
    expect(result.payoffs[0].totalInterestPaid).toBeLessThan(
      slow.payoffs[0].totalInterestPaid,
    );
  });

  it("refinance event changes rate and payment mid-simulation", () => {
    const base = minimalPlan();
    base.scenario.horizonYears = 5;
    base.liabilities = [
      { id: "loan1", name: "Loan", principal: 50000, annualInterestRate: 10, monthlyPayment: 1100 },
    ];
    const noRefi = simulate(base);

    const refi = JSON.parse(JSON.stringify(base)) as Plan;
    refi.scenario.events = [
      {
        id: "e1",
        type: "refinance",
        label: "Refi",
        liabilityId: "loan1",
        month: 6,
        newAnnualInterestRate: 4,
        newMonthlyPayment: 1100,
        closingCosts: 0,
      },
    ];
    const result = simulate(refi);
    expect(result.payoffs[0].month).toBeLessThan(noRefi.payoffs[0].month);
    expect(result.payoffs[0].totalInterestPaid).toBeLessThan(
      noRefi.payoffs[0].totalInterestPaid,
    );
  });
});

describe("simulate — scripted events", () => {
  it("job loss removes income for the given window", () => {
    const plan = minimalPlan();
    plan.scenario.events = [
      {
        id: "e1",
        type: "jobLoss",
        label: "Layoff",
        incomeSourceId: "inc1",
        startMonth: 3,
        durationMonths: 2,
      },
    ];
    const result = simulate(plan);
    expect(result.months[1].grossIncome).toBeCloseTo(10000, 5); // month 2: employed
    expect(result.months[2].grossIncome).toBe(0); // month 3
    expect(result.months[3].grossIncome).toBe(0); // month 4
    expect(result.months[4].grossIncome).toBeCloseTo(10000, 5); // month 5: back
  });

  it("new income event adds (optionally taxed) income from its start month", () => {
    const plan = minimalPlan();
    plan.scenario.events = [
      {
        id: "e1",
        type: "newIncome",
        label: "Rental",
        monthlyAmount: 1000,
        startMonth: 6,
        annualGrowthRate: 0,
        taxable: false,
      },
    ];
    const result = simulate(plan);
    expect(result.months[4].netIncome).toBeCloseTo(7500, 5);
    expect(result.months[5].netIncome).toBeCloseTo(8500, 5); // untaxed
  });

  it("windfalls and one-time expenses hit cash in their month", () => {
    const plan = minimalPlan();
    plan.scenario.events = [
      { id: "e1", type: "windfall", label: "Bonus", amount: 5000, month: 2 },
      { id: "e2", type: "oneTimeExpense", label: "Roof", amount: 3000, month: 4 },
    ];
    const result = simulate(plan);
    const delta2 = result.months[1].cash - result.months[0].cash;
    expect(delta2).toBeCloseTo(2500 + 5000, 5);
    const delta4 = result.months[3].cash - result.months[2].cash;
    expect(delta4).toBeCloseTo(2500 - 3000, 5);
  });

  it("expense change event adjusts a category from its month", () => {
    const plan = minimalPlan();
    plan.scenario.events = [
      {
        id: "e1",
        type: "expenseChange",
        label: "Cut spending",
        categoryId: "cat1",
        month: 7,
        newMonthlyAmount: 4000,
      },
    ];
    const result = simulate(plan);
    expect(result.months[5].totalExpenses).toBeCloseTo(5000, 5);
    expect(result.months[6].totalExpenses).toBeCloseTo(4000, 5);
  });
});

describe("simulate — asset growth", () => {
  it("grows investments and depreciates vehicles", () => {
    const plan = minimalPlan();
    plan.assets.push(
      { id: "inv1", name: "401k", kind: "investment", value: 100000, annualRate: 7 },
      { id: "car1", name: "Car", kind: "vehicle", value: 20000, annualRate: -12 },
    );
    const result = simulate(plan);
    const last = result.months[11];
    expect(last.investments).toBeCloseTo(107000, 0);
    expect(last.vehicleValue).toBeCloseTo(20000 * 0.88, 0);
  });

  it("contributions land in their linked asset", () => {
    const plan = minimalPlan();
    plan.assets.push({ id: "inv1", name: "401k", kind: "investment", value: 0, annualRate: 0 });
    plan.budget.push({
      id: "cat-contrib",
      name: "401k contribution",
      kind: "contribution",
      monthlyAmount: 1000,
      inflationAdjusted: false,
      essential: true,
      linkedId: "inv1",
    });
    const result = simulate(plan);
    expect(result.months[11].investments).toBeCloseTo(12000, 5);
    // Contributions reduce surplus
    expect(result.months[0].surplus).toBeCloseTo(1500, 5);
  });

  it("market return adjustment shifts investment growth", () => {
    const plan = minimalPlan();
    plan.assets.push({ id: "inv1", name: "401k", kind: "investment", value: 100000, annualRate: 7 });
    plan.scenario.marketReturnAdjustment = -7;
    const result = simulate(plan);
    expect(result.months[11].investments).toBeCloseTo(100000, 0);
  });
});

describe("simulate — default plan sanity", () => {
  it("runs the shipped default plan without errors and grows net worth", () => {
    const result = simulate(defaultPlan());
    expect(result.months).toHaveLength(120);
    expect(result.endNetWorth).toBeGreaterThan(result.startNetWorth);
    expect(result.firstCashCrunchMonth).toBeNull();
    // Auto loan (18k @ 7%, $450/mo) pays off inside the horizon.
    expect(result.payoffs.some((p) => p.name === "Auto loan")).toBe(true);
  });
});

describe("growOneMonth", () => {
  it("compounds to the annual rate over 12 months", () => {
    let v = 1000;
    for (let i = 0; i < 12; i++) v = growOneMonth(v, 5);
    expect(v).toBeCloseTo(1050, 6);
  });
});
