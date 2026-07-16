import { useEffect, useRef, useState } from "react";
import type { Plan } from "./types";
import { loadPlan, savePlan, exportPlan, importPlan, resetPlan } from "./storage";
import HouseholdTab from "./components/HouseholdTab";
import BudgetTab from "./components/BudgetTab";
import AssetsTab from "./components/AssetsTab";
import ScenarioTab from "./components/ScenarioTab";
import ResultsTab from "./components/ResultsTab";

const TABS = [
  { id: "household", label: "Household & Income" },
  { id: "budget", label: "Monthly Budget" },
  { id: "assets", label: "Assets & Debts" },
  { id: "scenario", label: "Scenario & What-ifs" },
  { id: "results", label: "Results" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [tab, setTab] = useState<TabId>("household");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPlan(await importPlan(file));
    } catch {
      alert("Could not import that file — it doesn't look like a saved plan.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Family Financial Planning Simulator</h1>
        <span className="subtitle">
          All data stays in this browser — nothing is uploaded.
        </span>
        <div className="header-actions">
          <button className="btn small" onClick={() => exportPlan(plan)}>
            Export plan
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Import plan
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm("Reset everything back to the sample plan?")) {
                setPlan(resetPlan());
              }
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "household" && <HouseholdTab plan={plan} setPlan={setPlan} />}
      {tab === "budget" && <BudgetTab plan={plan} setPlan={setPlan} />}
      {tab === "assets" && <AssetsTab plan={plan} setPlan={setPlan} />}
      {tab === "scenario" && <ScenarioTab plan={plan} setPlan={setPlan} />}
      {tab === "results" && <ResultsTab plan={plan} />}
    </div>
  );
}

export interface TabProps {
  plan: Plan;
  setPlan: React.Dispatch<React.SetStateAction<Plan>>;
}
