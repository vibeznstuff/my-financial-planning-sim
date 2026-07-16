import { useState } from "react";
import type { TabProps } from "../App";
import type { Scenario, ScriptedEvent } from "../types";
import { uid } from "../defaults";
import { fmtMoney, monthToLabel } from "../format";
import { Field, NumInput } from "./fields";

type EventType = ScriptedEvent["type"];

const EVENT_LABELS: Record<EventType, string> = {
  jobLoss: "Job loss",
  newIncome: "New income",
  oneTimeExpense: "One-time expense",
  windfall: "Windfall",
  refinance: "Refinance a debt",
  expenseChange: "Change an expense",
};

function describeEvent(e: ScriptedEvent, plan: TabProps["plan"]): string {
  switch (e.type) {
    case "jobLoss": {
      const src = plan.household.incomeSources.find((s) => s.id === e.incomeSourceId);
      return `${src?.name ?? "Income"} lost for ${e.durationMonths} months starting ${monthToLabel(e.startMonth)}`;
    }
    case "newIncome":
      return `${fmtMoney(e.monthlyAmount)}/mo (${e.taxable ? "taxable" : "after-tax"}) starting ${monthToLabel(e.startMonth)}, growing ${e.annualGrowthRate}%/yr`;
    case "oneTimeExpense":
      return `${fmtMoney(e.amount)} spent in ${monthToLabel(e.month)}`;
    case "windfall":
      return `${fmtMoney(e.amount)} received in ${monthToLabel(e.month)}`;
    case "refinance": {
      const debt = plan.liabilities.find((l) => l.id === e.liabilityId);
      return `${debt?.name ?? "Debt"} → ${e.newAnnualInterestRate}% APR, ${fmtMoney(e.newMonthlyPayment)}/mo payment in ${monthToLabel(e.month)}${e.closingCosts ? `, ${fmtMoney(e.closingCosts)} closing costs` : ""}`;
    }
    case "expenseChange": {
      const cat = plan.budget.find((c) => c.id === e.categoryId);
      return `${cat?.name ?? "Category"} becomes ${fmtMoney(e.newMonthlyAmount)}/mo from ${monthToLabel(e.month)}`;
    }
  }
}

export default function ScenarioTab({ plan, setPlan }: TabProps) {
  const sc = plan.scenario;
  const update = (patch: Partial<Scenario>) =>
    setPlan((p) => ({ ...p, scenario: { ...p.scenario, ...patch } }));

  const [draftType, setDraftType] = useState<EventType>("jobLoss");
  const maxMonth = Math.round(sc.horizonYears * 12);

  const addEvent = () => {
    const base = { id: uid(), label: EVENT_LABELS[draftType] };
    let event: ScriptedEvent;
    switch (draftType) {
      case "jobLoss":
        event = {
          ...base,
          type: "jobLoss",
          incomeSourceId: plan.household.incomeSources[0]?.id ?? "",
          startMonth: 12,
          durationMonths: 6,
        };
        break;
      case "newIncome":
        event = {
          ...base,
          type: "newIncome",
          monthlyAmount: 1000,
          startMonth: 12,
          annualGrowthRate: 2,
          taxable: true,
        };
        break;
      case "oneTimeExpense":
        event = { ...base, type: "oneTimeExpense", amount: 5000, month: 12 };
        break;
      case "windfall":
        event = { ...base, type: "windfall", amount: 5000, month: 12 };
        break;
      case "refinance":
        event = {
          ...base,
          type: "refinance",
          liabilityId: plan.liabilities[0]?.id ?? "",
          month: 12,
          newAnnualInterestRate: 5,
          newMonthlyPayment: plan.liabilities[0]?.monthlyPayment ?? 0,
          closingCosts: 3000,
        };
        break;
      case "expenseChange":
        event = {
          ...base,
          type: "expenseChange",
          categoryId: plan.budget.find((c) => c.kind === "expense")?.id ?? "",
          month: 12,
          newMonthlyAmount: 0,
        };
        break;
    }
    update({ events: [...sc.events, event] });
  };

  const updateEvent = (id: string, patch: Partial<ScriptedEvent>) =>
    update({
      events: sc.events.map((e) =>
        e.id === id ? ({ ...e, ...patch } as ScriptedEvent) : e,
      ),
    });

  return (
    <>
      <div className="card">
        <h2>Simulation parameters</h2>
        <p className="hint">
          These what-if levers apply to the whole simulation. Everything runs
          instantly — check the Results tab after any change.
        </p>
        <div className="field-row">
          <Field label="Scenario name">
            <input value={sc.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Horizon (years)">
            <select
              value={sc.horizonYears}
              onChange={(e) => update({ horizonYears: Number(e.target.value) })}
            >
              {[1, 2, 5, 10, 15, 20, 30].map((y) => (
                <option key={y} value={y}>
                  {y} year{y > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inflation / CPI (%/yr)">
            <NumInput value={sc.inflationRate} step={0.25} onChange={(n) => update({ inflationRate: n })} />
          </Field>
          <Field label="Market return adjustment (±%/yr)">
            <NumInput
              value={sc.marketReturnAdjustment}
              step={0.5}
              onChange={(n) => update({ marketReturnAdjustment: n })}
            />
          </Field>
          <Field label="Income growth override (%/yr, blank = per-source)">
            <input
              type="number"
              step={0.5}
              value={sc.incomeGrowthOverride ?? ""}
              placeholder="per-source"
              onChange={(e) =>
                update({
                  incomeGrowthOverride:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>Scripted events</h2>
        <p className="hint">
          Layer life events onto the timeline: losing a job for a stretch,
          starting a rental income, refinancing the mortgage, a windfall, or a
          deliberate spending change. Months are 1-based from the start of the
          simulation (month 13 = start of year 2).
        </p>

        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <Field label="Event type">
            <select value={draftType} onChange={(e) => setDraftType(e.target.value as EventType)}>
              {Object.entries(EVENT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <button className="btn primary" onClick={addEvent}>
              + Add event
            </button>
          </div>
        </div>

        {sc.events.length === 0 && (
          <div className="empty">No events yet — the simulation runs on your baseline plan.</div>
        )}

        {sc.events.map((e) => (
          <div className="event-item" key={e.id}>
            <span className="event-type">{EVENT_LABELS[e.type]}</span>
            <div className="event-desc">
              <div>{e.label}</div>
              <div className="sub">{describeEvent(e, plan)}</div>
              <EventEditor event={e} plan={plan} maxMonth={maxMonth} onChange={(patch) => updateEvent(e.id, patch)} />
            </div>
            <button
              className="btn small danger"
              onClick={() => update({ events: sc.events.filter((x) => x.id !== e.id) })}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function EventEditor({
  event,
  plan,
  maxMonth,
  onChange,
}: {
  event: ScriptedEvent;
  plan: TabProps["plan"];
  maxMonth: number;
  onChange: (patch: Partial<ScriptedEvent>) => void;
}) {
  const row: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  };
  const label = (
    <Field label="Label">
      <input value={event.label} onChange={(e) => onChange({ label: e.target.value })} />
    </Field>
  );

  switch (event.type) {
    case "jobLoss":
      return (
        <div style={row}>
          {label}
          <Field label="Income source">
            <select
              value={event.incomeSourceId}
              onChange={(e) => onChange({ incomeSourceId: e.target.value } as Partial<ScriptedEvent>)}
            >
              {plan.household.incomeSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start month">
            <NumInput value={event.startMonth} min={1} max={maxMonth} onChange={(n) => onChange({ startMonth: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="Duration (months)">
            <NumInput value={event.durationMonths} min={1} onChange={(n) => onChange({ durationMonths: n } as Partial<ScriptedEvent>)} />
          </Field>
        </div>
      );
    case "newIncome":
      return (
        <div style={row}>
          {label}
          <Field label="Monthly amount ($)">
            <NumInput value={event.monthlyAmount} min={0} step={100} onChange={(n) => onChange({ monthlyAmount: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="Start month">
            <NumInput value={event.startMonth} min={1} max={maxMonth} onChange={(n) => onChange({ startMonth: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="Growth (%/yr)">
            <NumInput value={event.annualGrowthRate} step={0.5} onChange={(n) => onChange({ annualGrowthRate: n } as Partial<ScriptedEvent>)} />
          </Field>
          <label className="checkbox" style={{ alignSelf: "flex-end" }}>
            <input
              type="checkbox"
              checked={event.taxable}
              onChange={(e) => onChange({ taxable: e.target.checked } as Partial<ScriptedEvent>)}
            />
            taxable
          </label>
        </div>
      );
    case "oneTimeExpense":
    case "windfall":
      return (
        <div style={row}>
          {label}
          <Field label="Amount ($)">
            <NumInput value={event.amount} min={0} step={500} onChange={(n) => onChange({ amount: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="Month">
            <NumInput value={event.month} min={1} max={maxMonth} onChange={(n) => onChange({ month: n } as Partial<ScriptedEvent>)} />
          </Field>
        </div>
      );
    case "refinance":
      return (
        <div style={row}>
          {label}
          <Field label="Debt">
            <select
              value={event.liabilityId}
              onChange={(e) => onChange({ liabilityId: e.target.value } as Partial<ScriptedEvent>)}
            >
              {plan.liabilities.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Month">
            <NumInput value={event.month} min={1} max={maxMonth} onChange={(n) => onChange({ month: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="New rate (%)">
            <NumInput value={event.newAnnualInterestRate} step={0.125} onChange={(n) => onChange({ newAnnualInterestRate: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="New payment ($/mo)">
            <NumInput value={event.newMonthlyPayment} min={0} step={50} onChange={(n) => onChange({ newMonthlyPayment: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="Closing costs ($)">
            <NumInput value={event.closingCosts} min={0} step={500} onChange={(n) => onChange({ closingCosts: n } as Partial<ScriptedEvent>)} />
          </Field>
        </div>
      );
    case "expenseChange":
      return (
        <div style={row}>
          {label}
          <Field label="Category">
            <select
              value={event.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value } as Partial<ScriptedEvent>)}
            >
              {plan.budget.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From month">
            <NumInput value={event.month} min={1} max={maxMonth} onChange={(n) => onChange({ month: n } as Partial<ScriptedEvent>)} />
          </Field>
          <Field label="New amount ($/mo)">
            <NumInput value={event.newMonthlyAmount} min={0} step={50} onChange={(n) => onChange({ newMonthlyAmount: n } as Partial<ScriptedEvent>)} />
          </Field>
        </div>
      );
  }
}
