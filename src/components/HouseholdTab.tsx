import type { TabProps } from "../App";
import type { Household } from "../types";
import { uid } from "../defaults";
import { fmtMoney } from "../format";
import { Field, NumInput } from "./fields";

export default function HouseholdTab({ plan, setPlan }: TabProps) {
  const hh = plan.household;
  const update = (patch: Partial<Household>) =>
    setPlan((p) => ({ ...p, household: { ...p.household, ...patch } }));

  const totalGross = hh.incomeSources.reduce((s, x) => s + x.annualGross, 0);
  const netMonthly = (totalGross * (1 - hh.effectiveTaxRate / 100)) / 12;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total household income (pre-tax)</div>
          <div className="stat-value">{fmtMoney(totalGross)}</div>
          <div className="stat-sub">per year</div>
        </div>
        <div className="stat">
          <div className="stat-label">Estimated net income</div>
          <div className="stat-value">{fmtMoney(netMonthly)}</div>
          <div className="stat-sub">
            per month after {hh.effectiveTaxRate}% effective tax
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Income sources</h2>
        <p className="hint">
          Add one row per income stream. A single-earner household can keep just
          one; a couple can list both. Add more rows for side income you already
          have. Growth rate models expected raises.
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Annual gross ($)</th>
                <th className="num">Growth (%/yr)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {hh.incomeSources.map((src) => (
                <tr key={src.id}>
                  <td>
                    <input
                      value={src.name}
                      aria-label="Income source name"
                      onChange={(e) =>
                        update({
                          incomeSources: hh.incomeSources.map((x) =>
                            x.id === src.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <NumInput
                      value={src.annualGross}
                      min={0}
                      step={1000}
                      aria-label="Annual gross income"
                      onChange={(n) =>
                        update({
                          incomeSources: hh.incomeSources.map((x) =>
                            x.id === src.id ? { ...x, annualGross: n } : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <NumInput
                      value={src.annualGrowthRate}
                      step={0.5}
                      aria-label="Annual growth rate"
                      onChange={(n) =>
                        update({
                          incomeSources: hh.incomeSources.map((x) =>
                            x.id === src.id ? { ...x, annualGrowthRate: n } : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      onClick={() =>
                        update({
                          incomeSources: hh.incomeSources.filter(
                            (x) => x.id !== src.id,
                          ),
                        })
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
              update({
                incomeSources: [
                  ...hh.incomeSources,
                  { id: uid(), name: "New income source", annualGross: 0, annualGrowthRate: 3 },
                ],
              })
            }
          >
            + Add income source
          </button>
        </div>

        <h3>Taxes</h3>
        <div className="field-row" style={{ maxWidth: 320 }}>
          <Field label="Effective tax rate (%) — federal + state + FICA combined">
            <NumInput
              value={hh.effectiveTaxRate}
              min={0}
              max={60}
              step={0.5}
              onChange={(n) => update({ effectiveTaxRate: n })}
            />
          </Field>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Household & retirement target</h2>
          <p className="hint">
            Choose whether this is a one- or two-adult household. Ages drive the
            retirement projection (planned around the older adult in a couple).
          </p>
          <div className="field-row">
            <Field label="Household type">
              <select
                value={hh.householdType}
                aria-label="Household type"
                onChange={(e) =>
                  update(
                    e.target.value === "single"
                      ? { householdType: "single", partnerAge: null }
                      : { householdType: "couple", partnerAge: hh.partnerAge ?? hh.primaryAge },
                  )
                }
              >
                <option value="single">Single (one adult)</option>
                <option value="couple">Couple (two adults)</option>
              </select>
            </Field>
            <Field label={hh.householdType === "couple" ? "Your age (adult 1)" : "Your age"}>
              <NumInput value={hh.primaryAge} min={18} max={100} onChange={(n) => update({ primaryAge: n })} />
            </Field>
            {hh.householdType === "couple" && (
              <Field label="Partner's age (adult 2)">
                <NumInput
                  value={hh.partnerAge ?? hh.primaryAge}
                  min={18}
                  max={100}
                  onChange={(n) => update({ partnerAge: n })}
                />
              </Field>
            )}
            <Field label="Target retirement age">
              <NumInput value={hh.targetRetirementAge} min={30} max={80} onChange={(n) => update({ targetRetirementAge: n })} />
            </Field>
          </div>
        </div>

        <div className="card">
          <h2>Dependents</h2>
          <p className="hint">
            Anyone you financially support — children, elderly parents, or a
            disabled family member. Mark each as a <strong>Child</strong> (under
            18, checked for college-savings readiness) or{" "}
            <strong>Other dependent</strong> (elderly parent, adult, or disabled
            family — skips the college check). Higher age caps let you record
            adult dependents.
          </p>
          {hh.dependents.length === 0 && <div className="empty">No dependents added.</div>}
          <table className="data">
            <tbody>
              {hh.dependents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      value={d.name}
                      aria-label="Dependent name"
                      onChange={(e) =>
                        update({
                          dependents: hh.dependents.map((x) =>
                            x.id === d.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td style={{ width: 150 }}>
                    <select
                      value={d.kind}
                      aria-label="Dependent type"
                      onChange={(e) =>
                        update({
                          dependents: hh.dependents.map((x) =>
                            x.id === d.id
                              ? { ...x, kind: e.target.value as "child" | "other" }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="child">Child</option>
                      <option value="other">Other dependent</option>
                    </select>
                  </td>
                  <td className="num" style={{ width: 90 }}>
                    <NumInput
                      value={d.age}
                      min={0}
                      max={110}
                      aria-label="Dependent age"
                      onChange={(n) =>
                        update({
                          dependents: hh.dependents.map((x) =>
                            x.id === d.id ? { ...x, age: n } : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td style={{ width: 90 }}>
                    <button
                      className="btn small danger"
                      onClick={() =>
                        update({ dependents: hh.dependents.filter((x) => x.id !== d.id) })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() =>
                update({
                  dependents: [
                    ...hh.dependents,
                    { id: uid(), name: "Dependent", age: 0, kind: "child" },
                  ],
                })
              }
            >
              + Add dependent
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
