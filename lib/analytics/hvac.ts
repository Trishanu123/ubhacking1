import { LIFETIMES } from "./assumptions";
import { costRange, SQFT_PER_TON, UNIT_COSTS } from "./cost-model";
import { dollarSavings, fmt, type MeasureContext, type MeasureDraft } from "./measure";
import {
  coolingImprovement,
  existingHeatingEfficiency,
  HEAT_PUMP,
  hvacControlsReduction,
  NEW_HEATING_EFFICIENCY,
} from "./savings-model";

const usesFossilHeat = (ctx: MeasureContext) =>
  ctx.building.heatingFuel !== "electric" && ctx.baseline.endUse.spaceHeatingTherms > 0;

/** HVAC controls / building automation / EMS — a low-capex opportunity. */
export function evaluateHvacControls(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, building, profile, areaSqFt } = ctx;
  if (areaSqFt <= 0) return null;
  const r = hvacControlsReduction(building.yearBuilt);
  const hvacKwh = baseline.endUse.coolingKwh + baseline.endUse.fansKwh;
  const elecKwh = hvacKwh * r.elec;
  const gasTherms = baseline.endUse.spaceHeatingTherms * r.gas;
  const savings = dollarSavings(ctx, elecKwh, gasTherms);
  if (savings <= 0) return null;
  const cost = costRange("hvacControlsPerSqFt", areaSqFt, "Controls/EMS");

  return {
    id: "hvac-controls-ems",
    category: "controls",
    name: profile.dcvApplicable ? "HVAC Controls, EMS & Demand-Controlled Ventilation" : "HVAC Controls & Energy Management",
    description:
      "Upgrade building automation / energy management: optimized schedules, setbacks, supply-air and water resets" +
      (profile.dcvApplicable ? ", and occupancy-based (demand-controlled) ventilation." : "."),
    elecKwh,
    gasTherms,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.controls,
    complexity: "low",
    confidence: "medium",
    fit: 0.85,
    fitReasons: ["Controls improvements apply broadly and require limited capital", "Savings depend on current control sophistication"],
    assumptions: [
      r.rationale,
      `HVAC electricity (cooling + fans) assumed ${fmt.pct(profile.elec.cooling + profile.elec.fans)} of electricity.`,
      `Space heating assumed ${fmt.pct(profile.gas.spaceHeating)} of natural gas use.`,
      "Actual savings depend on existing controls, operating schedules, occupancy and weather.",
    ],
    calculation: [
      { label: "HVAC electricity", expression: `${fmt.kwh(baseline.electricityKwh)} × ${fmt.pct(profile.elec.cooling + profile.elec.fans)}`, result: fmt.kwh(hvacKwh) },
      { label: "Electric savings", expression: `${fmt.kwh(hvacKwh)} × ${fmt.pct(r.elec)}`, result: fmt.kwh(elecKwh) },
      { label: "Space-heating gas", expression: `${fmt.therms(baseline.naturalGasTherms)} × ${fmt.pct(profile.gas.spaceHeating)}`, result: fmt.therms(baseline.endUse.spaceHeatingTherms) },
      { label: "Gas savings", expression: `${fmt.therms(baseline.endUse.spaceHeatingTherms)} × ${fmt.pct(r.gas)}`, result: fmt.therms(gasTherms) },
      {
        label: "Estimated annual savings",
        expression: `${fmt.kwh(elecKwh)} × ${fmt.rate(baseline.electricityRate, "kWh")} + ${fmt.therms(gasTherms)} × ${fmt.rate(baseline.gasRate, "therm")}`,
        result: `${fmt.usd(savings)}/yr`,
      },
    ],
    reason:
      "Controls and retro-commissioning typically require modest capital and can reduce both heating and cooling energy, making them a strong early-phase candidate.",
    nextStep: "Review current BAS/thermostat schedules and request a retro-commissioning or controls assessment.",
  };
}

/** High-efficiency heating & cooling replacement (replace-on-burnout basis). */
export function evaluateHvacModernization(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, building, areaSqFt } = ctx;
  if (areaSqFt <= 0) return null;
  const oldEff = existingHeatingEfficiency(building.yearBuilt);
  const cool = coolingImprovement(building.yearBuilt);
  const heatTherms = baseline.endUse.spaceHeatingTherms;
  const heatPct = usesFossilHeat(ctx) ? Math.max(0, 1 - oldEff.value / NEW_HEATING_EFFICIENCY.value) : 0;
  const gasTherms = heatTherms * heatPct;
  const elecKwh = baseline.endUse.coolingKwh * cool.value;
  const savings = dollarSavings(ctx, elecKwh, gasTherms);
  if (savings <= 0) return null;

  const tons = areaSqFt / SQFT_PER_TON[building.buildingType];
  const oldBuilding = building.yearBuilt == null || building.yearBuilt < 2008;
  // Older equipment: replacement is likely due, so the decision-relevant cost is the incremental premium.
  const cost = oldBuilding
    ? costRange("hvacIncrementalPerTon", tons, "Incremental high-efficiency premium")
    : costRange("hvacFullPerTon", tons, "Early replacement");
  const fullRef = Math.round(tons * UNIT_COSTS.hvacFullPerTon.typical);

  return {
    id: "hvac-modernization",
    category: "hvac",
    name: "High-Efficiency HVAC Modernization",
    description:
      "Replace aging heating and cooling equipment with high-efficiency (condensing heating, high-SEER/variable-speed cooling) equipment.",
    elecKwh,
    gasTherms,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.hvac,
    complexity: "high",
    confidence: building.yearBuilt == null ? "low" : "medium",
    fit: oldBuilding && heatTherms > 0 ? 0.85 : 0.45,
    fitReasons: oldBuilding
      ? ["Building vintage suggests HVAC equipment may be near end of useful life", "Meaningful space-heating load"]
      : ["Equipment may not yet be at end of life — early replacement is harder to justify"],
    assumptions: [
      oldEff.rationale,
      NEW_HEATING_EFFICIENCY.rationale,
      cool.rationale,
      `Cooling capacity estimated at ${Math.round(tons)} tons (${SQFT_PER_TON[building.buildingType]} sq ft/ton).`,
      oldBuilding
        ? `Cost basis is the incremental premium of high-efficiency over standard replacement, assuming equipment is near end of life. Full replacement reference ≈ ${fmt.usd(fullRef)}.`
        : "Cost basis is full early replacement because equipment age suggests it is not yet at end of life.",
      "Equipment age, condition and capacity require on-site verification.",
    ],
    calculation: [
      { label: "Space-heating gas", expression: `${fmt.therms(baseline.naturalGasTherms)} × space-heating share`, result: fmt.therms(heatTherms) },
      {
        label: "Heating efficiency gain",
        expression: `1 − ${fmt.pct(oldEff.value)} ÷ ${fmt.pct(NEW_HEATING_EFFICIENCY.value)}`,
        result: fmt.pct(heatPct),
      },
      { label: "Gas savings", expression: `${fmt.therms(heatTherms)} × ${fmt.pct(heatPct)}`, result: fmt.therms(gasTherms) },
      { label: "Cooling savings", expression: `${fmt.kwh(baseline.endUse.coolingKwh)} × ${fmt.pct(cool.value)}`, result: fmt.kwh(elecKwh) },
      {
        label: "Estimated annual savings",
        expression: `${fmt.therms(gasTherms)} × ${fmt.rate(baseline.gasRate, "therm")} + ${fmt.kwh(elecKwh)} × ${fmt.rate(baseline.electricityRate, "kWh")}`,
        result: `${fmt.usd(savings)}/yr`,
      },
    ],
    reason:
      "The building's heating load and vintage suggest high-efficiency replacement could reduce heating fuel use, especially if equipment is approaching end of life.",
    nextStep: "Verify HVAC equipment type, age, capacity and condition; obtain high-efficiency replacement quotes.",
    alternativeGroup: "heating-system",
  };
}

/** Cold-climate heat pump (hybrid / partial electrification). */
export function evaluateHeatPump(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, building, areaSqFt } = ctx;
  if (areaSqFt <= 0 || !usesFossilHeat(ctx)) return null;
  const heatTherms = baseline.endUse.spaceHeatingTherms;
  if (heatTherms < 500) return null;

  const oldEff = existingHeatingEfficiency(building.yearBuilt);
  const coverage = HEAT_PUMP.coverage.value;
  const cop = HEAT_PUMP.seasonalCop.value;
  const gasDisplaced = heatTherms * coverage;
  const usefulHeatKbtu = gasDisplaced * 100 * oldEff.value;
  const addedKwh = usefulHeatKbtu / 3.412 / cop;
  const coolingKwh = baseline.endUse.coolingKwh * HEAT_PUMP.coolingImprovement.value;
  const netElecKwh = coolingKwh - addedKwh; // negative = added electricity
  const savings = dollarSavings(ctx, netElecKwh, gasDisplaced);

  const tons = areaSqFt / SQFT_PER_TON[building.buildingType];
  const cost = costRange("heatPumpPerTon", tons, "Cold-climate heat pumps");
  const breakEvenCop = (baseline.electricityRate * 100) / 3.412 / (baseline.gasRate / oldEff.value);

  return {
    id: "heat-pump-hybrid",
    category: "heat_pump",
    name: "Cold-Climate Heat Pump (Hybrid Electrification)",
    description:
      "Add cold-climate air-source heat pumps to carry most of the heating load, retaining gas as backup. Reduces on-site combustion and emissions.",
    elecKwh: netElecKwh,
    gasTherms: gasDisplaced,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.heat_pump,
    complexity: "high",
    confidence: "low",
    fit: 0.6,
    fitReasons: [
      "Building uses fossil-fuel heating with a substantial heating load",
      `Operating-cost outcome is sensitive to the gas/electric price ratio (break-even COP ≈ ${breakEvenCop.toFixed(1)})`,
    ],
    assumptions: [
      HEAT_PUMP.coverage.rationale,
      HEAT_PUMP.seasonalCop.rationale,
      oldEff.rationale,
      HEAT_PUMP.coolingImprovement.rationale,
      `At current rates, heat pumps reduce operating cost only if seasonal COP exceeds ≈ ${breakEvenCop.toFixed(1)}.`,
      "Electrical service capacity, distribution system compatibility and cold-weather performance require engineering review.",
    ],
    calculation: [
      { label: "Gas displaced", expression: `${fmt.therms(heatTherms)} × ${fmt.pct(coverage)} coverage`, result: fmt.therms(gasDisplaced) },
      {
        label: "Added electricity",
        expression: `${fmt.therms(gasDisplaced)} × 100 kBtu × ${fmt.pct(oldEff.value)} ÷ 3.412 ÷ COP ${cop}`,
        result: fmt.kwh(addedKwh),
      },
      { label: "Cooling savings", expression: `${fmt.kwh(baseline.endUse.coolingKwh)} × ${fmt.pct(HEAT_PUMP.coolingImprovement.value)}`, result: fmt.kwh(coolingKwh) },
      {
        label: "Net annual savings",
        expression: `${fmt.therms(gasDisplaced)} × ${fmt.rate(baseline.gasRate, "therm")} − ${fmt.kwh(addedKwh - coolingKwh)} × ${fmt.rate(baseline.electricityRate, "kWh")}`,
        result: `${fmt.usd(savings)}/yr`,
      },
    ],
    reason:
      savings > 0
        ? "Heat pumps could reduce heating fuel cost and emissions; incentives for heat pumps can be significant in some territories."
        : "Heat pumps would substantially cut on-site emissions, but at current gas and electric rates operating costs may not fall. Worth exploring for decarbonization goals or alongside solar.",
    nextStep: "Have an HVAC engineer assess electrification feasibility, electrical capacity and Clean Heat program eligibility.",
    alternativeGroup: "heating-system",
  };
}
