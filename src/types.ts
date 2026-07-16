/**
 * Domain model for the family financial planning simulator.
 * All monetary values are in dollars; all rates are annual percentages
 * (e.g. 7 means 7%/yr) unless otherwise noted.
 */

// ---------------------------------------------------------------------------
// Household & income
// ---------------------------------------------------------------------------

export interface IncomeSource {
  id: string;
  name: string; // e.g. "Spouse 1 salary"
  annualGross: number; // pre-tax annual income
  annualGrowthRate: number; // expected raises, %/yr
}

export interface Household {
  incomeSources: IncomeSource[];
  /** Blended effective tax rate applied to gross income (federal + state + FICA). */
  effectiveTaxRate: number;
  /** Ages drive the retirement projection. */
  spouse1Age: number;
  spouse2Age: number;
  targetRetirementAge: number;
  /** Dependents, used for college-savings blind-spot analysis. */
  dependents: Dependent[];
}

export interface Dependent {
  id: string;
  name: string;
  age: number;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export type BudgetCategoryKind =
  | "expense" // money that leaves the household (groceries, Netflix, insurance…)
  | "contribution" // money moved into a linked asset (savings, 401k, 529…)
  | "debtPayment"; // extra payment toward a linked liability (on top of its required payment)

export interface BudgetCategory {
  id: string;
  name: string;
  kind: BudgetCategoryKind;
  monthlyAmount: number;
  /** Expense rises with CPI in the simulation when true. */
  inflationAdjusted: boolean;
  /** Essential vs. discretionary — drives the "where can we cut" insight. */
  essential: boolean;
  /** For contribution/debtPayment kinds: the asset or liability the money goes to. */
  linkedId?: string;
}

// ---------------------------------------------------------------------------
// Assets & liabilities
// ---------------------------------------------------------------------------

export type AssetKind = "cash" | "investment" | "property" | "vehicle";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** Current balance or market value. */
  value: number;
  /**
   * Annual rate of change, %/yr:
   *  - cash: APY
   *  - investment: expected average yield
   *  - property: appreciation
   *  - vehicle: depreciation (enter a negative number, e.g. -12)
   */
  annualRate: number;
}

export interface Liability {
  id: string;
  name: string; // e.g. "Mortgage", "Student loan"
  principal: number; // remaining principal today
  annualInterestRate: number; // APR, %/yr
  monthlyPayment: number; // required monthly payment (P&I)
  /** Optional: asset this debt is secured by (e.g. the house), for equity reporting. */
  securedAssetId?: string;
}

// ---------------------------------------------------------------------------
// Scenario (what-if parameters + scripted events)
// ---------------------------------------------------------------------------

export type ScriptedEvent =
  | JobLossEvent
  | NewIncomeEvent
  | OneTimeExpenseEvent
  | WindfallEvent
  | RefinanceEvent
  | ExpenseChangeEvent;

export interface JobLossEvent {
  id: string;
  type: "jobLoss";
  label: string;
  incomeSourceId: string;
  startMonth: number; // 1-based month index into the simulation
  durationMonths: number;
}

export interface NewIncomeEvent {
  id: string;
  type: "newIncome";
  label: string; // e.g. "Rental property income"
  monthlyAmount: number;
  startMonth: number;
  annualGrowthRate: number;
  /** Whether the new income is taxed at the household effective rate. */
  taxable: boolean;
}

export interface OneTimeExpenseEvent {
  id: string;
  type: "oneTimeExpense";
  label: string; // e.g. "New roof"
  amount: number;
  month: number;
}

export interface WindfallEvent {
  id: string;
  type: "windfall";
  label: string; // e.g. "Bonus", "Inheritance"
  amount: number;
  month: number;
}

export interface RefinanceEvent {
  id: string;
  type: "refinance";
  label: string;
  liabilityId: string;
  month: number;
  newAnnualInterestRate: number;
  newMonthlyPayment: number;
  /** Closing costs rolled into principal at refinance time. */
  closingCosts: number;
}

export interface ExpenseChangeEvent {
  id: string;
  type: "expenseChange";
  label: string; // e.g. "Cut eating out by half"
  categoryId: string;
  month: number;
  newMonthlyAmount: number;
}

export interface Scenario {
  name: string;
  horizonYears: number;
  /** CPI assumption applied to inflation-adjusted expenses, %/yr. */
  inflationRate: number;
  /**
   * Added to every investment asset's expected yield, %/yr.
   * Use it to test optimistic (+2) or pessimistic (-3) markets.
   */
  marketReturnAdjustment: number;
  /**
   * Optional override for income growth. When set, replaces each income
   * source's own growth rate.
   */
  incomeGrowthOverride: number | null;
  events: ScriptedEvent[];
}

// ---------------------------------------------------------------------------
// The full plan (persisted document)
// ---------------------------------------------------------------------------

export interface Plan {
  version: 1;
  household: Household;
  budget: BudgetCategory[];
  assets: Asset[];
  liabilities: Liability[];
  scenario: Scenario;
}

// ---------------------------------------------------------------------------
// Simulation output
// ---------------------------------------------------------------------------

export interface MonthSnapshot {
  month: number; // 1-based
  /** Calendar-ish label, e.g. "Yr 2 · Mo 3". */
  label: string;
  grossIncome: number;
  netIncome: number;
  totalExpenses: number; // expenses + required debt payments (excl. contributions)
  totalContributions: number;
  totalDebtPayments: number; // required + extra payments actually made
  surplus: number; // net income - everything out; lands in the default cash account
  cash: number;
  investments: number;
  propertyValue: number;
  vehicleValue: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  homeEquity: number;
  debtBalances: Record<string, number>; // liabilityId -> remaining principal
  categorySpend: Record<string, number>; // categoryId -> amount this month
}

export interface DebtPayoff {
  liabilityId: string;
  name: string;
  month: number; // month the balance reached zero
  totalInterestPaid: number;
}

export interface SimulationResult {
  months: MonthSnapshot[];
  payoffs: DebtPayoff[];
  /** Months where the household ran a deficit (surplus < 0). */
  deficitMonths: number;
  /** First month cash went negative, or null if it never did. */
  firstCashCrunchMonth: number | null;
  endNetWorth: number;
  startNetWorth: number;
  averageSavingsRate: number; // (contributions + surplus) / net income, averaged
}
