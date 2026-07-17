import type { Plan } from "./types";
import { defaultPlan } from "./defaults";

const KEY = "family-financial-plan-v1";

/**
 * Fill in fields added after a plan may have been saved, so older stored
 * plans keep working instead of breaking on missing values. Preserves all of
 * the user's existing data; only supplies defaults for new fields.
 */
function normalizePlan(plan: Plan): Plan {
  const h = plan.household as Plan["household"] & {
    spouse1Age?: number;
    spouse2Age?: number;
  };
  const household: Plan["household"] = {
    ...h,
    // householdType and the primary/partner ages replaced spouse1/spouse2Age.
    householdType: h.householdType ?? "couple",
    primaryAge: h.primaryAge ?? h.spouse1Age ?? 40,
    partnerAge:
      h.partnerAge ?? h.spouse2Age ?? (h.householdType === "single" ? null : 38),
    dependents: (h.dependents ?? []).map((d) => ({
      ...d,
      kind: d.kind ?? "child",
    })),
  };
  return { ...plan, household };
}

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPlan();
    const parsed = JSON.parse(raw) as Plan;
    if (parsed.version !== 1) return defaultPlan();
    return normalizePlan(parsed);
  } catch {
    return defaultPlan();
  }
}

export function savePlan(plan: Plan): void {
  localStorage.setItem(KEY, JSON.stringify(plan));
}

export function exportPlan(plan: Plan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financial-plan.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function importPlan(file: File): Promise<Plan> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Plan;
        if (parsed.version !== 1) throw new Error("Unsupported plan version");
        resolve(normalizePlan(parsed));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function resetPlan(): Plan {
  localStorage.removeItem(KEY);
  return defaultPlan();
}
