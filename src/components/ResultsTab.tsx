import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Plan } from "../types";
import { simulate } from "../engine/simulate";
import { analyze, type Insight } from "../engine/insights";
import { fmtMoney, fmtMoneyCompact, fmtPct, monthToLabel } from "../format";
import { useChartPalette } from "./palette";

export default function ResultsTab({ plan }: { plan: Plan }) {
  const pal = useChartPalette();
  const result = useMemo(() => simulate(plan), [plan]);
  const analysis = useMemo(() => analyze(plan, result), [plan, result]);

  const last = result.months[result.months.length - 1];
  const chartData = result.months.map((m) => ({
    month: m.month,
    label: m.label,
    netWorth: Math.round(m.netWorth),
    investments: Math.round(m.investments),
    cash: Math.round(m.cash),
    totalDebt: Math.round(m.totalDebt),
    netIncome: Math.round(m.netIncome),
    spending: Math.round(m.totalExpenses + m.totalDebtPayments),
    contributions: Math.round(m.totalContributions),
    ...Object.fromEntries(
      Object.entries(m.debtBalances).map(([id, v]) => [id, Math.round(v)]),
    ),
  }));

  const budgetBars = plan.budget
    .filter((c) => c.monthlyAmount > 0)
    .map((c) => ({
      name: c.name,
      amount: c.monthlyAmount,
      kind: c.kind,
    }))
    .sort((a, b) => b.amount - a.amount);

  const yearly = result.months.filter((m) => m.month % 12 === 0);

  const axisProps = {
    stroke: pal.baseline,
    tick: { fill: pal.muted, fontSize: 11 },
    tickLine: false,
  };
  const tooltipStyle = {
    contentStyle: {
      background: pal.surface,
      border: `1px solid ${pal.grid}`,
      borderRadius: 8,
      fontSize: 12,
      color: pal.text,
    },
    labelStyle: { color: pal.text, fontWeight: 600 },
    formatter: (v: number | string) => fmtMoney(Number(v)),
    labelFormatter: (m: number | string) => monthToLabel(Number(m)),
  } as const;
  const legendStyle = { fontSize: 12, color: pal.text } as const;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Net worth at year {plan.scenario.horizonYears}</div>
          <div className={`stat-value ${last.netWorth >= 0 ? "positive" : "negative"}`}>
            {fmtMoney(last.netWorth)}
          </div>
          <div className="stat-sub">
            {fmtMoney(result.startNetWorth)} today ·{" "}
            {last.netWorth >= result.startNetWorth ? "+" : ""}
            {fmtMoney(last.netWorth - result.startNetWorth)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Investments at horizon</div>
          <div className="stat-value">{fmtMoney(last.investments)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Remaining debt at horizon</div>
          <div className="stat-value">{fmtMoney(last.totalDebt)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Average savings rate</div>
          <div className="stat-value">{fmtPct(result.averageSavingsRate * 100)}</div>
          <div className="stat-sub">of net income</div>
        </div>
      </div>

      <div className="card chart-card">
        <h2>Net worth over time — “{plan.scenario.name}”</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => `Yr ${Math.ceil(m / 12)}`} interval={11} />
            <YAxis {...axisProps} tickFormatter={fmtMoneyCompact} width={60} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
            <ReferenceLine y={0} stroke={pal.baseline} />
            <Line type="monotone" dataKey="netWorth" name="Net worth" stroke={pal.series[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="investments" name="Investments" stroke={pal.series[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="cash" name="Cash" stroke={pal.series[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="totalDebt" name="Total debt" stroke={pal.series[3]} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        {result.firstCashCrunchMonth !== null && (
          <p className="chart-note">
            ⚠ Cash goes negative in {monthToLabel(result.firstCashCrunchMonth)}.
          </p>
        )}
      </div>

      <div className="card chart-card">
        <h2>Monthly cash flow</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => `Yr ${Math.ceil(m / 12)}`} interval={11} />
            <YAxis {...axisProps} tickFormatter={fmtMoneyCompact} width={60} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
            <Line type="monotone" dataKey="netIncome" name="Net income" stroke={pal.series[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="spending" name="Expenses + debt payments" stroke={pal.series[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="contributions" name="Contributions" stroke={pal.series[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {plan.liabilities.length > 0 && (
        <div className="card chart-card">
          <h2>Debt payoff timeline</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={pal.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => `Yr ${Math.ceil(m / 12)}`} interval={11} />
              <YAxis {...axisProps} tickFormatter={fmtMoneyCompact} width={60} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
              {plan.liabilities.slice(0, 8).map((l, i) => (
                <Line
                  key={l.id}
                  type="monotone"
                  dataKey={l.id}
                  name={l.name}
                  stroke={pal.series[i % pal.series.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {result.payoffs.length > 0 && (
            <p className="chart-note">
              {result.payoffs
                .sort((a, b) => a.month - b.month)
                .map(
                  (p) =>
                    `${p.name} paid off ${monthToLabel(p.month)} (${fmtMoney(p.totalInterestPaid)} total interest)`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="card chart-card">
        <h2>Where the monthly budget goes</h2>
        <ResponsiveContainer width="100%" height={Math.max(180, budgetBars.length * 32)}>
          <BarChart data={budgetBars} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={pal.grid} horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={fmtMoneyCompact} />
            <YAxis type="category" dataKey="name" {...axisProps} width={170} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => String(l)} />
            <Bar dataKey="amount" name="Monthly amount" fill={pal.series[0]} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className="chart-note">
          Contributions and extra debt payments are included — they're part of
          the monthly outflow even though they build wealth.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Is our spending sustainable?</h2>
          <InsightList items={analysis.sustainability} />
        </div>
        <div className="card">
          <h2>Retirement outlook</h2>
          <InsightList items={analysis.retirement} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Blind spots</h2>
          <InsightList items={analysis.blindSpots} />
        </div>
        <div className="card">
          <h2>Where scaling back moves the needle</h2>
          <p className="hint">
            Discretionary categories ranked by size. “Impact” = value at the
            horizon of redirecting a 25% cut into investments.
          </p>
          {analysis.opportunities.length === 0 ? (
            <div className="empty">
              No discretionary categories — mark some budget rows non-essential
              to see opportunities.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">$/mo</th>
                  <th className="num">$/yr</th>
                  <th className="num">Impact of 25% cut</th>
                </tr>
              </thead>
              <tbody>
                {analysis.opportunities.map((o) => (
                  <tr key={o.categoryId}>
                    <td>{o.name}</td>
                    <td className="num">{fmtMoney(o.monthlyAmount)}</td>
                    <td className="num">{fmtMoney(o.annualAmount)}</td>
                    <td className="num">{fmtMoney(o.horizonImpactOfQuarterCut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Supplemental income ideas</h2>
        {analysis.incomeIdeas.map((idea) => (
          <div className="insight" key={idea.title}>
            <div>
              <div className="insight-title">{idea.title}</div>
              <div className="insight-detail">{idea.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Year-by-year detail</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Net income</th>
                <th className="num">Spending</th>
                <th className="num">Contributions</th>
                <th className="num">Cash</th>
                <th className="num">Investments</th>
                <th className="num">Total debt</th>
                <th className="num">Home equity</th>
                <th className="num">Net worth</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((m) => (
                <tr key={m.month}>
                  <td>{m.month / 12}</td>
                  <td className="num">{fmtMoney(m.netIncome * 12)}</td>
                  <td className="num">{fmtMoney((m.totalExpenses + m.totalDebtPayments) * 12)}</td>
                  <td className="num">{fmtMoney(m.totalContributions * 12)}</td>
                  <td className="num">{fmtMoney(m.cash)}</td>
                  <td className="num">{fmtMoney(m.investments)}</td>
                  <td className="num">{fmtMoney(m.totalDebt)}</td>
                  <td className="num">{fmtMoney(m.homeEquity)}</td>
                  <td className="num">{fmtMoney(m.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">
          Income/spending columns annualize that year's final month; balances
          are end-of-year.
        </p>
      </div>
    </>
  );
}

function InsightList({ items }: { items: Insight[] }) {
  return (
    <>
      {items.map((ins, i) => (
        <div className="insight" key={i}>
          <span className={`badge ${ins.status}`}>{badgeLabel(ins.status)}</span>
          <div>
            <div className="insight-title">{ins.title}</div>
            <div className="insight-detail">{ins.detail}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function badgeLabel(status: Insight["status"]): string {
  switch (status) {
    case "good":
      return "✓ good";
    case "warning":
      return "! watch";
    case "serious":
      return "!! gap";
    case "critical":
      return "✕ risk";
  }
}
