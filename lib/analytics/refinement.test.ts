import { beforeAll, describe, expect, it } from "vitest";
import { demoAnalyzeRequest } from "@/lib/demo/demo-building";
import type { Analysis } from "@/lib/types/analysis";
import { runAnalysis } from "./pipeline";
import { refineAnalysis } from "./refinement";
import { planningInput } from "@/lib/wny/types";
import { pricedUpgrades } from "@/lib/wny/costs";
import { combineSelection } from "@/lib/wny/selection";
import { summarizePortfolio } from "./portfolio";
import { assessConfidence } from "./confidence";
import { packageTotals } from "./budget-planner";

let original: Analysis;
beforeAll(async () => { original = await runAnalysis(demoAnalyzeRequest()); }, 30000);
const rec = (a: Analysis, id: string) => a.recommendations.find(r => r.id === id)!;

describe("equipment-informed estimates", () => {
  it("preserves the original analysis when no inputs are provided", () => {
    expect(refineAnalysis(original, { measures: {} })).toBe(original);
  });
  it("recalculates lighting from count, watts, hours and explicit hour scenarios", () => {
    const before = structuredClone(original);
    const a = refineAnalysis(original, { measures: { "lighting-led-controls": { fixtureCount: 100, oldWatts: 64, newWatts: 20, annualHours: 3000, hoursLow: 2800, hoursHigh: 3200, lightingControlsPct: 0 } } });
    const r = rec(a, "lighting-led-controls");
    expect(r.annualElectricitySavingsKwh).toBe(13200);
    expect(r.estimatedAnnualSavings).toBe(1980);
    expect(r.savingsRange).toEqual({ low: 1848, high: 2112 });
    expect(r.annualCo2eSavingsTons).toBeCloseTo(1.6, 1);
    const priced = pricedUpgrades(planningInput(a));
    expect(priced.find(p => p.id === r.id)!.estimate.components.find(c => c.catalogId === "led")!.quantity).toBe(100);
    expect(priced.find(p => p.id === r.id)!.estimate.installed.typical).toBe(16000);
    expect(priced.find(p => p.id === r.id)!.systems).toEqual(["led"]);
    expect(combineSelection(a, [r.id], priced).savingsRange).toEqual(r.savingsRange);
    expect(original).toEqual(before);
  });
  it("rejects incomplete inventories, impossible building totals and reversed hour bounds", () => {
    for (const fields of [
      { fixtureCount: 100 }, { lightingControlsPct: 10 },
      { fixtureCount: 100000, oldWatts: 1000, newWatts: 20, annualHours: 8760 },
      { fixtureCount: 100, oldWatts: 64, newWatts: 20, annualHours: 3000, hoursLow: 4000, hoursHigh: 2000 },
    ]) expect(() => refineAnalysis(original, { measures: { "lighting-led-controls": fields } })).toThrow();
  });
  it("uses both seasonal heating efficiencies and a bounded actual heating load", () => {
    const a = refineAnalysis(original, { measures: { "hvac-modernization": { heatingTherms: 10000, existingEfficiencyPct: 80, newEfficiencyPct: 95 } } });
    expect(rec(a, "hvac-modernization").annualGasSavingsTherms).toBe(Math.round(10000 * (1 - 80 / 95)));
    expect(() => refineAnalysis(original, { measures: { "hvac-modernization": { heatingTherms: 100000, existingEfficiencyPct: 80, newEfficiencyPct: 95 } } })).toThrow();
  });
  it("subtracts heat-pump electricity rather than treating gas displacement as pure savings", () => {
    const a = refineAnalysis(original, { measures: { "heat-pump-hybrid": { heatingTherms: 10000, existingEfficiencyPct: 80, seasonalCop: 3, heatingCoveragePct: 70 } } });
    const r = rec(a, "heat-pump-hybrid");
    expect(r.annualGasSavingsTherms).toBe(7000);
    expect(r.annualElectricitySavingsKwh).toBeLessThan(0);
    const expectedKwh = original.energy.endUse.coolingKwh * 0.15 - 7000 * 100 * 0.8 / 3.412 / 3;
    expect(r.annualElectricitySavingsKwh).toBe(Math.round(expectedKwh));
    expect(r.estimatedAnnualSavings).toBe(Math.round(expectedKwh * 0.15 + 7000 * 1.1));
  });
  it("applies documented controls and envelope reductions to their affected loads", () => {
    const a = refineAnalysis(original, { measures: { "hvac-controls-ems": { electricReductionPct: 5, gasReductionPct: 4 }, "envelope-weatherization": { gasReductionPct: 3 } } });
    expect(rec(a, "hvac-controls-ems").annualGasSavingsTherms).toBe(Math.round(original.energy.endUse.spaceHeatingTherms * 0.04));
    expect(rec(a, "envelope-weatherization").annualGasSavingsTherms).toBe(Math.round(original.energy.endUse.spaceHeatingTherms * 0.03));
  });
  it("calculates water heating with the entered load, efficiency and seasonal COP", () => {
    const template = { ...rec(original, "heat-pump-hybrid"), id: "test-water-heater", category: "water_heating" as const };
    const sample = { ...original, recommendations: [...original.recommendations, template] };
    const a = refineAnalysis(sample, { measures: { "test-water-heater": { heatingTherms: 1000, existingEfficiencyPct: 80, seasonalCop: 3 } } });
    const r = rec(a, "test-water-heater");
    const addedKwh = 1000 * 100 * 0.8 / 3.412 / 3;
    expect(r.annualGasSavingsTherms).toBe(1000);
    expect(r.annualElectricitySavingsKwh).toBe(-Math.round(addedKwh));
    expect(r.estimatedAnnualSavings).toBe(Math.round(1100 - addedKwh * 0.15));
  });
  it("uses proposed solar capacity for generation and cost sizing without claiming measured weather", () => {
    const a = refineAnalysis(original, { measures: { "solar-pv": { solarKw: 20 } } });
    expect(rec(a, "solar-pv").annualElectricitySavingsKwh).toBe(Math.round(20 * original.solar.specificYieldKwhPerKw));
    const priced = pricedUpgrades(planningInput(a)).find(r => r.id === "solar-pv")!;
    expect(priced.estimate.components[0].quantity).toBe(20);
    expect(priced.estimate.notes.join(" ")).toContain("Weather");
  });
  it("calculates demand-charge savings from tariff, peak reduction, months and losses", () => {
    const a = refineAnalysis(original, { measures: { "battery-storage": { demandReductionKw: 10, demandRate: 15, billingMonths: 10, addedElectricityKwh: 1000 } } });
    expect(rec(a, "battery-storage").estimatedAnnualSavings).toBe(1350);
    expect(rec(a, "battery-storage").annualElectricitySavingsKwh).toBe(-1000);
    expect(() => refineAnalysis(original, { measures: { "battery-storage": { demandReductionKw: original.energy.peakDemandKw + 1, demandRate: 15 } } })).toThrow();
  });
  it("uses an entered quote and incentive as inputs rather than shrinking generic cost bands", () => {
    const a = refineAnalysis(original, { measures: { "lighting-led-controls": { quotedCost: 20000, confirmedIncentive: 3000 } } });
    const priced = pricedUpgrades(planningInput(a)).find(r => r.id === "lighting-led-controls")!;
    expect(priced.estimate.installed).toEqual({ low: 20000, typical: 20000, high: 20000 });
    expect(priced.estimate.net.typical).toBe(17000);
    expect(priced.estimate.payback.typical).toBeCloseTo(17000 / priced.estimatedAnnualSavings);
    expect(priced.estimate.payback.low).toBeCloseTo(17000 / priced.savingsRange.high);
    expect(priced.estimate.payback.high).toBeCloseTo(17000 / priced.savingsRange.low);
    expect(priced.estimate.notes.join(" ")).toContain("your entered quote");
  });
  it("updates rates for every measure and keeps company/AI snapshots aligned with refinements", () => {
    const a = refineAnalysis(original, { electricityRate: 0.2, gasRate: 1.4, measures: { "solar-pv": { solarKw: 20, quotedCost: 40000 } } });
    const r = rec(a, "solar-pv");
    expect(r.estimatedAnnualSavings).toBe(Math.round(20 * original.solar.specificYieldKwhPerKw * 0.2 * 0.9));
    expect(a.energy.annualEnergyCost).toBe(original.energy.electricityKwh * 0.2 + original.energy.naturalGasTherms * 1.4);
    expect(planningInput(a).recommendations.find(p => p.id === r.id)!.estimateEvidence?.quotedCost).toBe(40000);
  });
  it("keeps uncertain costs broad without a quote and handles missing or invalid inputs", () => {
    const priced = pricedUpgrades(planningInput(original));
    expect(priced.every(r => r.estimate.installed.low < r.estimate.installed.high)).toBe(true);
    expect(() => refineAnalysis(original, { electricityRate: 0, measures: {} })).toThrow();
    expect(() => refineAnalysis(original, { measures: { invented: { quotedCost: 5 } } })).toThrow();
  });
});

describe("portfolio consistency", () => {
  it("uses the same overlap, signed fuels and solar caps as selected packages", () => {
    const included = original.recommendations.filter(r => r.includedInPortfolio);
    const summary = summarizePortfolio(included, original.energy);
    const effects = packageTotals(included, original.energy, "NY");
    expect(summary.potentialAnnualSavings).toBe(Math.round(effects.annualSavings));
    expect(summary.postRetrofitElectricityKwh).toBe(Math.round(Math.max(0, original.energy.electricityKwh - effects.annualElectricitySavingsKwh)));
  });
  it("does not drop added electricity in fuel-switching portfolio totals", () => {
    const hp = { ...rec(original, "heat-pump-hybrid"), includedInPortfolio: true };
    const summary = summarizePortfolio([hp], original.energy);
    expect(summary.postRetrofitElectricityKwh).toBeGreaterThan(original.energy.electricityKwh);
  });
  it("does not count demo provenance as measured consumption or tariffs", () => {
    const confidence = assessConfidence(original.building, original.energy);
    expect(confidence.factors.find(f => f.label === "Utility consumption")!.met).toBe(false);
    expect(confidence.factors.find(f => f.label === "Utility rates")!.met).toBe(false);
  });
});
