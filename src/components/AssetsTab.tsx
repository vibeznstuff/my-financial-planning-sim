import type { TabProps } from "../App";
import type { Asset, AssetKind, Liability } from "../types";
import { uid } from "../defaults";
import { fmtMoney } from "../format";

const KIND_LABELS: Record<AssetKind, string> = {
  cash: "Cash (checking/savings)",
  investment: "Investment",
  property: "Property",
  vehicle: "Vehicle",
};

const RATE_HINT: Record<AssetKind, string> = {
  cash: "APY",
  investment: "avg yield",
  property: "appreciation",
  vehicle: "depreciation (negative)",
};

export default function AssetsTab({ plan, setPlan }: TabProps) {
  const { assets, liabilities } = plan;

  const updateAsset = (id: string, patch: Partial<Asset>) =>
    setPlan((p) => ({
      ...p,
      assets: p.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  const updateDebt = (id: string, patch: Partial<Liability>) =>
    setPlan((p) => ({
      ...p,
      liabilities: p.liabilities.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalDebt = liabilities.reduce((s, l) => s + l.principal, 0);
  const equityByDebt = liabilities
    .filter((l) => l.securedAssetId)
    .map((l) => {
      const secured = assets.find((a) => a.id === l.securedAssetId);
      return secured
        ? { name: secured.name, equity: secured.value - l.principal }
        : null;
    })
    .filter(Boolean) as { name: string; equity: number }[];

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total assets</div>
          <div className="stat-value">{fmtMoney(totalAssets)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total debt</div>
          <div className="stat-value">{fmtMoney(totalDebt)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Net worth today</div>
          <div className={`stat-value ${totalAssets - totalDebt >= 0 ? "positive" : "negative"}`}>
            {fmtMoney(totalAssets - totalDebt)}
          </div>
        </div>
        {equityByDebt.map((e) => (
          <div className="stat" key={e.name}>
            <div className="stat-label">{e.name} equity</div>
            <div className="stat-value">{fmtMoney(e.equity)}</div>
            <div className="stat-sub">value minus remaining principal</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Assets</h2>
        <p className="hint">
          Annual rate meaning depends on type: APY for cash, expected average
          yield for investments, appreciation for property, depreciation for
          vehicles (enter a negative number, e.g. -12).
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="num">Current value ($)</th>
                <th className="num">Annual rate (%)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td style={{ minWidth: 150 }}>
                    <input
                      value={a.name}
                      aria-label="Asset name"
                      onChange={(e) => updateAsset(a.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={a.kind}
                      aria-label="Asset type"
                      onChange={(e) => updateAsset(a.id, { kind: e.target.value as AssetKind })}
                    >
                      {Object.entries(KIND_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num" style={{ width: 130 }}>
                    <input
                      type="number"
                      step={1000}
                      value={a.value}
                      aria-label="Current value"
                      onChange={(e) => updateAsset(a.id, { value: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num" style={{ width: 110 }}>
                    <input
                      type="number"
                      step={0.1}
                      value={a.annualRate}
                      aria-label={`Annual rate (${RATE_HINT[a.kind]})`}
                      title={RATE_HINT[a.kind]}
                      onChange={(e) => updateAsset(a.id, { annualRate: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          assets: p.assets.filter((x) => x.id !== a.id),
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
                assets: [
                  ...p.assets,
                  { id: uid(), name: "New asset", kind: "cash", value: 0, annualRate: 0 },
                ],
              }))
            }
          >
            + Add asset
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Debts</h2>
        <p className="hint">
          Loans amortize monthly in the simulation: interest accrues on the
          balance, the payment covers interest first, and the remainder reduces
          principal. Link a debt to the asset securing it (house, car) to track
          equity over time. Add extra principal payments as "Extra debt payment"
          budget categories.
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Remaining principal ($)</th>
                <th className="num">Interest rate (%)</th>
                <th className="num">Monthly payment ($)</th>
                <th>Secured by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <tr key={l.id}>
                  <td style={{ minWidth: 130 }}>
                    <input
                      value={l.name}
                      aria-label="Debt name"
                      onChange={(e) => updateDebt(l.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="num" style={{ width: 140 }}>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={l.principal}
                      aria-label="Remaining principal"
                      onChange={(e) => updateDebt(l.id, { principal: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num" style={{ width: 100 }}>
                    <input
                      type="number"
                      min={0}
                      step={0.125}
                      value={l.annualInterestRate}
                      aria-label="Annual interest rate"
                      onChange={(e) =>
                        updateDebt(l.id, { annualInterestRate: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="num" style={{ width: 120 }}>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={l.monthlyPayment}
                      aria-label="Monthly payment"
                      onChange={(e) => updateDebt(l.id, { monthlyPayment: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <select
                      value={l.securedAssetId ?? ""}
                      aria-label="Secured by asset"
                      onChange={(e) =>
                        updateDebt(l.id, { securedAssetId: e.target.value || undefined })
                      }
                    >
                      <option value="">(unsecured)</option>
                      {assets
                        .filter((a) => a.kind === "property" || a.kind === "vehicle")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          liabilities: p.liabilities.filter((x) => x.id !== l.id),
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
                liabilities: [
                  ...p.liabilities,
                  {
                    id: uid(),
                    name: "New debt",
                    principal: 0,
                    annualInterestRate: 5,
                    monthlyPayment: 0,
                  },
                ],
              }))
            }
          >
            + Add debt
          </button>
        </div>
      </div>
    </>
  );
}
