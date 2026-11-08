import catalog from "@/data/wny-cost-catalog.json";
import { BUILDING_PROFILES, INCENTIVE_PLANNING_RATE } from "@/lib/analytics/assumptions";
import { SQFT_PER_TON } from "@/lib/analytics/cost-model";
import { computeMeasureFinancials, simplePayback } from "@/lib/analytics/financial";
import { sizeSolar } from "@/lib/analytics/solar";
import { STORAGE } from "@/lib/analytics/savings-model";
import { SEEDED_PROGRAMS } from "@/lib/services/incentives";
import type { CostEstimate, PlanningInput, PricedUpgrade, System } from "./types";

export const COST_CATALOG = catalog;
export function systemsFor(category: PlanningInput["recommendations"][number]["category"]): System[] {
  switch (category) {
    case "lighting": return ["led", "lighting_controls"];
    case "controls": return ["hvac_controls"];
    case "hvac": return ["furnace_boiler"];
    case "heat_pump": return ["air_source_heat_pump"];
    case "envelope": return ["air_sealing", "insulation"];
    case "water_heating": return ["heat_pump_water_heater"];
    case "solar": return ["rooftop_solar"];
    case "storage": return ["battery_storage"];
    default: return [];
  }
}

export function scaleCost(unit: { low: number; typical: number; high: number }, quantity: number, multiplier = 1) {
  if (![unit.low, unit.typical, unit.high, quantity, multiplier].every(Number.isFinite) || quantity < 0 || multiplier <= 0 || unit.low < 0 || unit.low > unit.typical || unit.typical > unit.high) throw new Error("Invalid cost range or quantity.");
  return { low: Math.round(unit.low * quantity * multiplier), typical: Math.round(unit.typical * quantity * multiplier), high: Math.round(unit.high * quantity * multiplier) };
}

export function estimateUpgrade(input: PlanningInput, rec: PlanningInput["recommendations"][number], year = new Date().getFullYear()): CostEstimate {
  const area = input.building.buildingAreaSqFt ?? 0;
  const profile = BUILDING_PROFILES[input.building.buildingType];
  const roof = input.building.footprintSqFt ?? area / Math.max(1, input.building.stories ?? profile.typicalStories);
  const quantities: Partial<Record<System, number>> = {
    led: Math.round(area / 1000 * profile.fixturesPer1000SqFt), lighting_controls: area,
    hvac_controls: area, furnace_boiler: area / SQFT_PER_TON[input.building.buildingType],
    air_source_heat_pump: area / SQFT_PER_TON[input.building.buildingType], air_sealing: area,
    insulation: roof, heat_pump_water_heater: input.energy.waterHeatingTherms,
    rooftop_solar: sizeSolar(roof, input.electricityKwh, input.solar.specificYieldKwhPerKw).systemKw,
    battery_storage: Math.max(20, Math.max(10, input.energy.peakDemandKw * STORAGE.sizingFractionOfPeak) * STORAGE.durationHours),
  };
  const systems = systemsFor(rec.category).filter(id => rec.estimateEvidence?.sizing[id] !== 0);
  const entries = systems.map(id => catalog.entries.find(e => e.id === id)!);
  const components = entries.map(e => ({ catalogId: e.id as System, quantity: rec.estimateEvidence?.sizing[e.id] ?? quantities[e.id as System] ?? 0, unit: e.unit }));
  const canScale = entries.length > 0 && entries.every((e, i) => e.low != null && e.typical != null && e.high != null && components[i].quantity > 0);
  const installed = rec.estimateEvidence?.quotedCost != null ? { low: rec.estimateEvidence.quotedCost, typical: rec.estimateEvidence.quotedCost, high: rec.estimateEvidence.quotedCost } : canScale ? entries.reduce((sum, e, i) => {
    const part = scaleCost({ low: e.low!, typical: e.typical!, high: e.high! }, components[i].quantity, e.buffaloRegionMultiplier ?? 1);
    return { low: sum.low + part.low, typical: sum.typical + part.typical, high: sum.high + part.high };
  }, { low: 0, typical: 0, high: 0 }) : { low: rec.cost.low, typical: rec.cost.typical, high: rec.cost.high };
  // Same category planning shares and capped-incentive/net/payback functions as the
  // existing engine. Only programs already matched by that engine are eligible.
  const programs = SEEDED_PROGRAMS.filter(p => rec.programIds.includes(p.id));
  const eligible = programs.filter(p => {
    const residentialCredit = /25[cd]\b/i.test(`${p.id} ${p.name} ${p.notes}`);
    // Never add a residential credit from an old or merely "verify" catalog entry.
    return !residentialCredit || (p.verificationDate.startsWith(`${year}-`) && !/verify|changed|confirm/i.test(`${p.incentiveValue} ${p.notes}`));
  });
  const rate = eligible.length ? (INCENTIVE_PLANNING_RATE[rec.category as keyof typeof INCENTIVE_PLANNING_RATE] ?? 0) : 0;
  const fin = (cost: number) => computeMeasureFinancials({ projectCost: cost, incentives: rec.estimateEvidence?.confirmedIncentive ?? Math.round(cost * rate), annualSavings: rec.estimatedAnnualSavings, lifetimeYears: rec.lifetimeYears });
  const low = fin(installed.low), typical = fin(installed.typical), high = fin(installed.high);
  return {
    installed, net: { low: low.netCost, typical: typical.netCost, high: high.netCost },
    incentives: { low: low.incentives, typical: typical.incentives, high: high.incentives },
    payback: {
      low: simplePayback(low.netCost, rec.savingsRange.high),
      typical: typical.paybackYears,
      high: simplePayback(high.netCost, rec.savingsRange.low),
    },
    components, provisional: true,
    notes: [
      ...(rec.estimateEvidence?.notes ?? []),
      rec.estimateEvidence?.quotedCost != null
        ? "Installed cost is your entered quote for this scope; catalog unit costs and regional multipliers do not override it. Confirm quote validity and exclusions."
        : "Estimate, get quotes to confirm. Buffalo multiplier is unverified; a neutral 1.0 is used. No inflation adjustment is assumed.",
      rec.estimateEvidence?.confirmedIncentive != null
        ? "Net cost uses your entered eligible incentive amount, capped at project cost. It has not been independently verified."
        : "Estimated after incentives uses existing category planning shares, not confirmed rebate awards. Verify eligibility and current amounts.",
      ...(!canScale && rec.estimateEvidence?.quotedCost == null ? ["Sizing is unavailable: the original engine range is retained as an unverified allowance."] : []),
      ...(rec.category === "hvac" && rec.estimateEvidence?.quotedCost == null ? ["Full replacement allowance is shown here, rather than the engine's possible incremental efficiency premium. Scope and capacity require a contractor survey."] : []),
      ...(input.building.state !== "NY" ? ["WNY allowances are not localized for properties outside New York."] : []),
    ],
    sources: entries.map(e => ({ label: e.label, url: e.sourceUrl, date: e.sourceDate, reviewed: e.lastReviewed, note: e.sourceNote })),
  };
}
export function pricedUpgrades(input: PlanningInput): PricedUpgrade[] {
  return input.recommendations.map(rec => ({ ...rec, systems: systemsFor(rec.category).filter(id => rec.estimateEvidence?.sizing[id] !== 0), estimate: estimateUpgrade(input, rec) }));
}
