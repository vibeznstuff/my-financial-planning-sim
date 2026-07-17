import { describe, it, expect } from "vitest";
import { simulate } from "./simulate";
import { analyze } from "./insights";
import { defaultPlan } from "../defaults";
import type { Plan } from "../types";

function planWith(mut: (p: Plan) => void): Plan {
  const p = JSON.parse(JSON.stringify(defaultPlan())) as Plan;
  mut(p);
  return p;
}

const analyzePlan = (p: Plan) => analyze(p, simulate(p));

describe("insights — household type", () => {
  it("single household plans retirement around the one adult's age", () => {
    // Primary age 55, no partner: only 10 years to a 65 retirement.
    const plan = planWith((p) => {
      p.household.householdType = "single";
      p.household.primaryAge = 55;
      p.household.partnerAge = null;
      p.household.incomeSources = [p.household.incomeSources[0]];
    });
    const projection = analyzePlan(plan).retirement.find((i) =>
      /balance at retirement/i.test(i.title),
    );
    expect(projection).toBeDefined();
    // The blind-spot emergency-fund copy adapts to a single household.
    const ef = analyzePlan(plan).blindSpots.find((i) =>
      /emergency fund/i.test(i.title),
    );
    expect(ef?.detail).toMatch(/single-income/i);
  });

  it("a couple's retirement is planned around the older adult", () => {
    const younger = planWith((p) => {
      p.household.householdType = "couple";
      p.household.primaryAge = 40;
      p.household.partnerAge = 40;
    });
    const older = planWith((p) => {
      p.household.householdType = "couple";
      p.household.primaryAge = 40;
      p.household.partnerAge = 60; // older partner shortens the runway
    });
    const coverage = (pl: Plan) =>
      analyzePlan(pl).retirement.find((i) => /4% rule/i.test(i.title))!.title;
    // Different runway ⇒ different projected coverage text.
    expect(coverage(younger)).not.toEqual(coverage(older));
  });
});

describe("insights — dependent kinds", () => {
  it("flags missing college savings for a child dependent", () => {
    const plan = planWith((p) => {
      p.household.dependents = [{ id: "d1", name: "Ada", age: 8, kind: "child" }];
      // Ensure no 529/college contribution exists.
      p.budget = p.budget.filter((c) => !/529|college|education/i.test(c.name));
    });
    const hit = analyzePlan(plan).blindSpots.find((i) =>
      /college savings/i.test(i.title),
    );
    expect(hit?.title).toContain("Ada");
  });

  it("does not raise a college-savings flag for an 'other' dependent", () => {
    const plan = planWith((p) => {
      p.household.dependents = [
        { id: "d1", name: "Grandpa", age: 78, kind: "other" },
      ];
    });
    const hit = analyzePlan(plan).blindSpots.find((i) =>
      /college savings/i.test(i.title),
    );
    expect(hit).toBeUndefined();
  });

  it("an adult-aged child dependent past 18 raises no college flag", () => {
    const plan = planWith((p) => {
      p.household.dependents = [{ id: "d1", name: "Older", age: 20, kind: "child" }];
    });
    const hit = analyzePlan(plan).blindSpots.find((i) =>
      /college savings/i.test(i.title),
    );
    expect(hit).toBeUndefined();
  });
});
