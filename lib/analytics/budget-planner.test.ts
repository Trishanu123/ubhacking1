import { describe, expect, it } from "vitest";
import { DEMO_BUILDING } from "@/lib/demo/demo-building";
import type { Recommendation } from "@/lib/types/recommendation";
import { computeBaseline } from "./energy-baseline";
import { makeContext } from "./measure";
import { buildRecommendations, evaluateMeasures } from "./recommendations";
import { planBudget } from "./budget-planner";

const energy = computeBaseline({
  building: DEMO_BUILDING, electricityKwh: 10000, naturalGasTherms: 1000,
  electricityRate: 0.2, gasRate: 1, peakDemandKw: 10,
  provenance: { electricityKwh: "user", naturalGasTherms: "user", electricityRate: "user", gasRate: "user" },
});
const context = makeContext(DEMO_BUILDING, energy, {
  method: "fallback", specificYieldKwhPerKw: 1250, monthlyKwhPerKw: null,
  tilt: 43, azimuth: 180, losses: 14, note: "test",
});
const realRecommendations = buildRecommendations(evaluateMeasures(context), context, []);
function rec(id: string, cost: number, savings: number, overrides: Partial<Recommendation> = {}): Recommendation {
  return { ...realRecommendations[0], id, category: "lighting", estimatedCost: cost,
    estimatedAnnualSavings: savings, annualElectricitySavingsKwh: savings / 0.2,
    annualGasSavingsTherms: 0, alternativeGroup: undefined, ...overrides };
}

describe("budget packages", () => {
  it("finds the best combination rather than greedily taking the largest single saving", () => {
    const plan = planBudget([rec("a", 600, 70), rec("b", 500, 60), rec("c", 500, 60)], energy, 1000, "bills", "NY");
    expect(plan.selected.map(r => r.id)).toEqual(["b", "c"]);
    expect(plan.annualSavings).toBeCloseTo(108);
    expect(plan.remainingBudget).toBe(0);
  });

  it("chooses different packages for bills, emissions and quickest payback", () => {
    const options = [rec("bills", 1000, 300), rec("fast", 100, 60), rec("carbon", 1000, -20, {
      category: "heat_pump", annualElectricitySavingsKwh: -1000, annualGasSavingsTherms: 400,
    })];
    expect(planBudget(options, energy, 1000, "bills", "NY").selected[0].id).toBe("bills");
    const carbon = planBudget(options, energy, 1000, "emissions", "NY");
    expect(carbon.selected[0].id).toBe("carbon");
    expect(carbon.annualElectricitySavingsKwh).toBe(-1000);
    expect(carbon.annualSavings).toBe(-20);
    expect(carbon.paybackYears).toBeNull();
    expect(carbon.savingsRange.low).toBeLessThan(carbon.savingsRange.high);
    const fast = planBudget(options, energy, 1000, "payback", "NY");
    expect(fast.selected[0].id).toBe("fast");
    expect(fast.remainingBudget).toBe(900);
  });

  it("never combines heating replacements, including older reports without group tags", () => {
    const options = [rec("furnace", 100, 40, { category: "hvac" }), rec("heatpump", 100, 60, { category: "heat_pump", includedInPortfolio: false })];
    const plan = planBudget(options, energy, 1000, "bills", "NY");
    expect(plan.selected.map(r => r.id)).toEqual(["heatpump"]);
  });

  it("honors declared alternatives and rejects duplicate measures", () => {
    const options = [rec("a", 100, 30, { alternativeGroup: "windows" }), rec("b", 100, 50, { alternativeGroup: "windows" }), rec("b", 100, 50)];
    const plan = planBudget(options, energy, 1000, "bills", "NY");
    expect(new Set(plan.selected.map(r => r.id)).size).toBe(plan.selected.length);
    expect(plan.selected.filter(r => r.alternativeGroup === "windows").length).toBeLessThanOrEqual(1);
  });

  it("uses upfront costs, not costs after uncertain rebates, and handles cents", () => {
    expect(planBudget([rec("a", 1000, 200, { netCost: 10, incentives: 990 })], energy, 100, "bills").selected).toEqual([]);
    const plan = planBudget([rec("a", 0.1, 10), rec("b", 0.2, 10)], energy, 0.3, "bills");
    expect(plan.upfrontCost).toBe(0.3);
    expect(plan.remainingBudget).toBe(0);
  });

  it("does not let solar and efficiency save the same purchased electricity", () => {
    const options = [rec("efficiency", 100, 1600), rec("solar", 100, 1800, { category: "solar", annualElectricitySavingsKwh: 10000 })];
    const plan = planBudget(options, energy, 200, "bills", "NY");
    expect(plan.selected).toHaveLength(2);
    expect(plan.annualElectricitySavingsKwh).toBe(10000);
    expect(plan.annualSavings).toBeCloseTo(1440 + 2800 * 0.18);
    expect(plan.annualSavings).toBeLessThan(energy.annualEnergyCost);
  });

  it("caps savings by available fuel without discarding fuel-switching increases", () => {
    const plan = planBudget([rec("oversized", 10, 4000, { annualElectricitySavingsKwh: 20000 })], energy, 10, "bills", "NY");
    expect(plan.annualElectricitySavingsKwh).toBe(energy.electricityKwh);
    expect(plan.annualSavings).toBeCloseTo(2000);
  });

  it("handles zero budgets and free upgrades, ignores invalid measures, and validates budgets", () => {
    expect(planBudget([rec("a", 1, 20)], energy, 0, "bills").selected).toEqual([]);
    expect(planBudget([rec("free", 0, 20)], energy, 0, "payback").paybackYears).toBe(0);
    expect(planBudget([rec("bad", NaN, 20)], energy, 100, "bills").selected).toEqual([]);
    for (const budget of [-1, NaN, Infinity, 1e10]) expect(() => planBudget([], energy, budget, "bills")).toThrow();
  });

  it("keeps real engine outputs intact and produces compatible affordable packages for all priorities", () => {
    const before = structuredClone(realRecommendations);
    for (const priority of ["bills", "emissions", "payback"] as const) {
      const plan = planBudget(realRecommendations, energy, 25000, priority, "NY");
      expect(plan.upfrontCost).toBeLessThanOrEqual(25000);
      expect(plan.selected.filter(r => r.category === "hvac" || r.category === "heat_pump").length).toBeLessThanOrEqual(1);
      expect(Number.isFinite(plan.annualSavings)).toBe(true);
    }
    expect(realRecommendations).toEqual(before);
  });
});
