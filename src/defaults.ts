import type { Plan } from "./types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * A realistic starter plan so the app is immediately explorable.
 * Every number is editable in the UI.
 */
export function defaultPlan(): Plan {
  const ids = {
    inc1: "inc-spouse1",
    inc2: "inc-spouse2",
    checking: "asset-checking",
    savings: "asset-savings",
    retirement: "asset-401k",
    brokerage: "asset-brokerage",
    house: "asset-house",
    car: "asset-car",
    mortgage: "debt-mortgage",
    studentLoan: "debt-studentloan",
    carLoan: "debt-carloan",
  };

  return {
    version: 1,
    household: {
      incomeSources: [
        { id: ids.inc1, name: "Spouse 1 salary", annualGross: 95000, annualGrowthRate: 3 },
        { id: ids.inc2, name: "Spouse 2 salary", annualGross: 75000, annualGrowthRate: 3 },
      ],
      effectiveTaxRate: 24,
      spouse1Age: 35,
      spouse2Age: 34,
      targetRetirementAge: 65,
      dependents: [{ id: uid(), name: "Child 1", age: 4 }],
    },
    budget: [
      { id: "cat-groceries", name: "Groceries", kind: "expense", monthlyAmount: 900, inflationAdjusted: true, essential: true },
      { id: "cat-eating-out", name: "Eating out", kind: "expense", monthlyAmount: 400, inflationAdjusted: true, essential: false },
      { id: "cat-utilities", name: "Utilities", kind: "expense", monthlyAmount: 350, inflationAdjusted: true, essential: true },
      { id: "cat-insurance", name: "Insurance (auto/life/home)", kind: "expense", monthlyAmount: 300, inflationAdjusted: true, essential: true },
      { id: "cat-childcare", name: "Childcare", kind: "expense", monthlyAmount: 1200, inflationAdjusted: true, essential: true },
      { id: "cat-subscriptions", name: "Subscriptions (Netflix etc.)", kind: "expense", monthlyAmount: 60, inflationAdjusted: false, essential: false },
      { id: "cat-shopping", name: "Shopping & misc", kind: "expense", monthlyAmount: 450, inflationAdjusted: true, essential: false },
      { id: "cat-travel", name: "Travel", kind: "expense", monthlyAmount: 250, inflationAdjusted: true, essential: false },
      { id: "cat-gas", name: "Gas & transportation", kind: "expense", monthlyAmount: 250, inflationAdjusted: true, essential: true },
      { id: "cat-401k", name: "401(k) contributions", kind: "contribution", monthlyAmount: 1000, inflationAdjusted: false, essential: true, linkedId: ids.retirement },
      { id: "cat-brokerage", name: "Brokerage investing", kind: "contribution", monthlyAmount: 300, inflationAdjusted: false, essential: false, linkedId: ids.brokerage },
      { id: "cat-savings", name: "Savings transfer", kind: "contribution", monthlyAmount: 300, inflationAdjusted: false, essential: false, linkedId: ids.savings },
      { id: "cat-extra-student", name: "Extra student loan payment", kind: "debtPayment", monthlyAmount: 100, inflationAdjusted: false, essential: false, linkedId: ids.studentLoan },
    ],
    assets: [
      { id: ids.checking, name: "Checking", kind: "cash", value: 8000, annualRate: 0.1 },
      { id: ids.savings, name: "High-yield savings", kind: "cash", value: 25000, annualRate: 4.2 },
      { id: ids.retirement, name: "401(k) accounts", kind: "investment", value: 120000, annualRate: 7 },
      { id: ids.brokerage, name: "Brokerage", kind: "investment", value: 20000, annualRate: 7 },
      { id: ids.house, name: "Home", kind: "property", value: 450000, annualRate: 3 },
      { id: ids.car, name: "Family car", kind: "vehicle", value: 24000, annualRate: -12 },
    ],
    liabilities: [
      { id: ids.mortgage, name: "Mortgage", principal: 320000, annualInterestRate: 6.25, monthlyPayment: 2100, securedAssetId: ids.house },
      { id: ids.studentLoan, name: "Student loans", principal: 38000, annualInterestRate: 5.5, monthlyPayment: 420 },
      { id: ids.carLoan, name: "Car loan", principal: 14000, annualInterestRate: 6.9, monthlyPayment: 380, securedAssetId: ids.car },
    ],
    scenario: {
      name: "Baseline",
      horizonYears: 10,
      inflationRate: 2.5,
      marketReturnAdjustment: 0,
      incomeGrowthOverride: null,
      events: [],
    },
  };
}
