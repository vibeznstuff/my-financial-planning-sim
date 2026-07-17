import type { Plan } from "./types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * A generic starter plan built from published U.S. national averages so the
 * app is immediately explorable without reflecting any real person's finances.
 * Every number is editable in the UI; hit "Reset" to return to this sample.
 *
 * Figures are round approximations of commonly cited public statistics
 * (U.S. Census household income; BLS Consumer Expenditure Survey for the
 * budget; Federal Reserve / industry averages for balances, home value, and
 * debt) as of the mid-2020s. They are illustrative, not precise, and are not
 * personalized to the user.
 */
export function defaultPlan(): Plan {
  const ids = {
    inc1: "inc-earner1",
    inc2: "inc-earner2",
    checking: "asset-checking",
    savings: "asset-savings",
    retirement: "asset-401k",
    brokerage: "asset-brokerage",
    house: "asset-house",
    car: "asset-car",
    mortgage: "debt-mortgage",
    studentLoan: "debt-studentloan",
    carLoan: "debt-carloan",
    creditCard: "debt-creditcard",
  };

  return {
    version: 1,
    household: {
      // Default to a two-earner couple; switch to "single" on the Household
      // tab for a one-adult household. Combined ~$110k ≈ average U.S.
      // household income, split across two earners.
      householdType: "couple",
      incomeSources: [
        { id: ids.inc1, name: "Earner 1 income", annualGross: 60000, annualGrowthRate: 3 },
        { id: ids.inc2, name: "Earner 2 income", annualGross: 50000, annualGrowthRate: 3 },
      ],
      effectiveTaxRate: 18,
      primaryAge: 40,
      partnerAge: 38,
      targetRetirementAge: 65,
      dependents: [{ id: uid(), name: "Child", age: 10, kind: "child" }],
    },
    // Monthly budget ≈ BLS Consumer Expenditure Survey averages.
    budget: [
      { id: "cat-utilities", name: "Utilities", kind: "expense", monthlyAmount: 450, inflationAdjusted: true, essential: true },
      { id: "cat-housing-costs", name: "Property tax, home insurance & upkeep", kind: "expense", monthlyAmount: 500, inflationAdjusted: true, essential: true },
      { id: "cat-groceries", name: "Groceries", kind: "expense", monthlyAmount: 500, inflationAdjusted: true, essential: true },
      { id: "cat-eating-out", name: "Eating out", kind: "expense", monthlyAmount: 350, inflationAdjusted: true, essential: false },
      { id: "cat-transport", name: "Gas & transportation", kind: "expense", monthlyAmount: 300, inflationAdjusted: true, essential: true },
      { id: "cat-auto-insurance", name: "Auto insurance", kind: "expense", monthlyAmount: 150, inflationAdjusted: true, essential: true },
      { id: "cat-healthcare", name: "Healthcare (premiums & out-of-pocket)", kind: "expense", monthlyAmount: 500, inflationAdjusted: true, essential: true },
      { id: "cat-dependent-care", name: "Childcare / dependent care", kind: "expense", monthlyAmount: 500, inflationAdjusted: true, essential: true },
      { id: "cat-apparel", name: "Apparel & personal care", kind: "expense", monthlyAmount: 150, inflationAdjusted: true, essential: false },
      { id: "cat-entertainment", name: "Entertainment", kind: "expense", monthlyAmount: 200, inflationAdjusted: true, essential: false },
      { id: "cat-subscriptions", name: "Subscriptions (streaming etc.)", kind: "expense", monthlyAmount: 50, inflationAdjusted: false, essential: false },
      { id: "cat-misc", name: "Miscellaneous", kind: "expense", monthlyAmount: 200, inflationAdjusted: true, essential: false },
      { id: "cat-401k", name: "401(k) / retirement contributions", kind: "contribution", monthlyAmount: 400, inflationAdjusted: false, essential: true, linkedId: ids.retirement },
      { id: "cat-savings", name: "Savings transfer", kind: "contribution", monthlyAmount: 200, inflationAdjusted: false, essential: false, linkedId: ids.savings },
    ],
    assets: [
      { id: ids.checking, name: "Checking", kind: "cash", value: 4000, annualRate: 0.1 },
      { id: ids.savings, name: "High-yield savings", kind: "cash", value: 10000, annualRate: 4.0 },
      { id: ids.retirement, name: "401(k) / IRA accounts", kind: "investment", value: 60000, annualRate: 7 },
      { id: ids.brokerage, name: "Brokerage", kind: "investment", value: 10000, annualRate: 7 },
      { id: ids.house, name: "Home", kind: "property", value: 420000, annualRate: 3 },
      { id: ids.car, name: "Vehicle", kind: "vehicle", value: 26000, annualRate: -12 },
    ],
    liabilities: [
      { id: ids.mortgage, name: "Mortgage", principal: 240000, annualInterestRate: 6.8, monthlyPayment: 1600, securedAssetId: ids.house },
      { id: ids.carLoan, name: "Auto loan", principal: 18000, annualInterestRate: 7, monthlyPayment: 450, securedAssetId: ids.car },
      { id: ids.studentLoan, name: "Student loans", principal: 30000, annualInterestRate: 5.5, monthlyPayment: 300 },
      { id: ids.creditCard, name: "Credit card", principal: 6000, annualInterestRate: 22, monthlyPayment: 200 },
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
