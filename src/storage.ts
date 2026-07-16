import type { Plan } from "./types";
import { defaultPlan } from "./defaults";

const KEY = "family-financial-plan-v1";

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPlan();
    const parsed = JSON.parse(raw) as Plan;
    if (parsed.version !== 1) return defaultPlan();
    return parsed;
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
        resolve(parsed);
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
