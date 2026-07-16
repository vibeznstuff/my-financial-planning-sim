import type { TabProps } from "../App";
import type { BudgetCategory, BudgetCategoryKind } from "../types";
import { uid } from "../defaults";
import { fmtMoney } from "../format";

const KIND_LABELS: Record<BudgetCategoryKind, string> = {
  expense: "Expense",
  contribution: "Contribution",
  debtPayment: "Extra debt payment",
};

export default function BudgetTab({ plan, setPlan }: TabProps) {
  const { budget, assets, liabilities, household } = plan;

  const updateCat = (id: string, patch: Partial<BudgetCategory>) =>
    setPlan((p) => ({
      ...p,
      budget: p.budget.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const totalGross = household.incomeSources.reduce((s, x) => s + x.annualGross, 0);
  const netMonthly = (totalGross * (1 - household.effectiveTaxRate / 100)) / 12;
  const requiredDebt = liabilities.reduce((s, l) => s + l.monthlyPayment, 0);
  const budgetTotal = budget.reduce((s, c) => s + c.monthlyAmount, 0);
  const remaining = netMonthly - budgetTotal - requiredDebt;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Net monthly income</div>
          <div className="stat-value">{fmtMoney(netMonthly)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Budgeted (incl. contributions)</div>
          <div className="stat-value">{fmtMoney(budgetTotal)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Required debt payments</div>
          <div className="stat-value">{fmtMoney(requiredDebt)}</div>
          <div className="stat-sub">set on the Assets & Debts tab</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unallocated</div>
          <div className={`stat-value ${remaining >= 0 ? "positive" : "negative"}`}>
            {fmtMoney(remaining)}
          </div>
          <div className="stat-sub">
            {remaining >= 0 ? "accumulates in cash each month" : "monthly overspend"}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Monthly budget categories</h2>
        <p className="hint">
          <strong>Expense</strong> = money leaving the household.{" "}
          <strong>Contribution</strong> = money moved into one of your accounts
          (savings, 401k, 529…). <strong>Extra debt payment</strong> = principal
          paid on top of a loan's required payment. "Essential" marks
          non-negotiable spending; "CPI" makes an expense rise with inflation in
          simulations.
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th className="num">Monthly ($)</th>
                <th>Goes to</th>
                <th>Essential</th>
                <th>CPI</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {budget.map((c) => (
                <tr key={c.id}>
                  <td style={{ minWidth: 160 }}>
                    <input
                      value={c.name}
                      aria-label="Category name"
                      onChange={(e) => updateCat(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={c.kind}
                      aria-label="Category type"
                      onChange={(e) =>
                        updateCat(c.id, {
                          kind: e.target.value as BudgetCategoryKind,
                          linkedId: undefined,
                        })
                      }
                    >
                      {Object.entries(KIND_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num" style={{ width: 110 }}>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={c.monthlyAmount}
                      aria-label="Monthly amount"
                      onChange={(e) =>
                        updateCat(c.id, { monthlyAmount: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td>
                    {c.kind === "contribution" && (
                      <select
                        value={c.linkedId ?? ""}
                        aria-label="Target account"
                        onChange={(e) => updateCat(c.id, { linkedId: e.target.value || undefined })}
                      >
                        <option value="">(default cash)</option>
                        {assets
                          .filter((a) => a.kind === "cash" || a.kind === "investment")
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    )}
                    {c.kind === "debtPayment" && (
                      <select
                        value={c.linkedId ?? ""}
                        aria-label="Target debt"
                        onChange={(e) => updateCat(c.id, { linkedId: e.target.value || undefined })}
                      >
                        <option value="">(choose a debt)</option>
                        {liabilities.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {c.kind === "expense" && <span className="empty">—</span>}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.essential}
                      aria-label="Essential"
                      onChange={(e) => updateCat(c.id, { essential: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.inflationAdjusted}
                      disabled={c.kind !== "expense"}
                      aria-label="Inflation adjusted"
                      onChange={(e) => updateCat(c.id, { inflationAdjusted: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          budget: p.budget.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn"
            onClick={() =>
              setPlan((p) => ({
                ...p,
                budget: [
                  ...p.budget,
                  {
                    id: uid(),
                    name: "New category",
                    kind: "expense",
                    monthlyAmount: 0,
                    inflationAdjusted: true,
                    essential: false,
                  },
                ],
              }))
            }
          >
            + Add category
          </button>
        </div>
      </div>
    </>
  );
}
