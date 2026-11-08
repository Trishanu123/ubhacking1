import type { Analysis } from "@/lib/types/analysis";
import { AnalysisRefinementsSchema, type AnalysisRefinements } from "@/lib/types/refinement";
import { computeMeasureFinancials, round } from "./financial";
import { EMISSIONS, UNIT } from "./assumptions";
import { gridFactor } from "./energy-baseline";
import { HEAT_PUMP, HPWH, SOLAR, existingHeatingEfficiency, hvacControlsReduction } from "./savings-model";
import { summarizePortfolio } from "./portfolio";

export class RefinementInputError extends Error { name = "RefinementInputError"; }

/** Equipment-based scenario recalculation; does not claim measured post-retrofit accuracy. */
export function refineAnalysis(original: Analysis, raw: AnalysisRefinements): Analysis {
  const inputs = AnalysisRefinementsSchema.parse(raw);
  if (!Object.keys(inputs.measures).length && inputs.electricityRate == null && inputs.gasRate == null) return original;
  for (const id of Object.keys(inputs.measures)) if (!original.recommendations.some(r => r.id === id)) throw new RefinementInputError("The refined upgrade is not in this analysis.");
  const er = inputs.electricityRate ?? original.energy.electricityRate;
  const gr = inputs.gasRate ?? original.energy.gasRate;
  const energy = { ...original.energy, electricityRate: er, gasRate: gr,
    electricityCost: original.energy.electricityKwh * er, gasCost: original.energy.naturalGasTherms * gr,
    annualEnergyCost: original.energy.electricityKwh * er + original.energy.naturalGasTherms * gr,
    provenance: { ...original.energy.provenance, ...(inputs.electricityRate != null ? { electricityRate: "user" as const } : {}), ...(inputs.gasRate != null ? { gasRate: "user" as const } : {}) },
  };
  const recs = original.recommendations.map(r => {
    const v = inputs.measures[r.id] ?? {};
    const notes: string[] = [];
    const sizing: Record<string, number> = {};
    let elec = r.annualElectricitySavingsKwh, gas = r.annualGasSavingsTherms;
    // Preserve demand/other benefits separately from energy-rate savings.
    let other = r.estimatedAnnualSavings - elec * original.energy.electricityRate - gas * original.energy.gasRate;
    let explicitHoursRange: { low: number; high: number } | null = null;
    const heat = v.heatingTherms ?? (r.category === "water_heating" ? energy.endUse.waterHeatingTherms : energy.endUse.spaceHeatingTherms);
    if (heat > energy.naturalGasTherms) throw new RefinementInputError("Heating gas use cannot exceed the property's annual gas use.");
    if (r.category === "lighting" && [v.fixtureCount, v.oldWatts, v.newWatts, v.annualHours, v.lightingControlsPct, v.hoursLow, v.hoursHigh].some(x => x != null)) {
      if ([v.fixtureCount, v.oldWatts, v.newWatts, v.annualHours].some(x => x == null)) throw new RefinementInputError("For lighting, enter fixture count, existing watts, proposed watts and annual operating hours together.");
      const count = v.fixtureCount!, oldW = v.oldWatts!, newW = v.newWatts!, hours = v.annualHours!;
      const controls = (v.lightingControlsPct ?? 20) / 100;
      if (count * oldW * hours / 1000 > energy.electricityKwh * 1.01) throw new RefinementInputError("This lighting inventory uses more electricity than the annual building total. Check count, watts and hours.");
      const perHour = count * (oldW - newW * (1 - controls)) / 1000;
      elec = perHour * hours; gas = 0; other = 0; sizing.led = count;
      if (v.lightingControlsPct === 0) sizing.lighting_controls = 0;
      notes.push("Lighting uses your entered count × (existing watts − proposed watts after controls) × operating hours ÷ 1,000.", v.lightingControlsPct == null ? "The existing 20% lighting-controls assumption remains; enter a documented value to replace it." : "Lighting-controls reduction is your entered scenario assumption.");
      if (v.hoursLow != null || v.hoursHigh != null) {
        if (v.hoursLow == null || v.hoursHigh == null || v.hoursLow > hours || v.hoursHigh < hours) throw new RefinementInputError("Enter both operating-hour bounds, with low ≤ expected ≤ high.");
        const ends = [perHour * v.hoursLow * er, perHour * v.hoursHigh * er];
        explicitHoursRange = { low: Math.min(...ends), high: Math.max(...ends) };
        notes.push("Savings bounds reflect your entered operating-hour scenarios with other inputs held fixed; they are not statistical confidence limits.");
      }
    } else if (r.category === "hvac" && [v.existingEfficiencyPct, v.newEfficiencyPct, v.heatingTherms].some(x => x != null)) {
      if (v.existingEfficiencyPct == null || v.newEfficiencyPct == null) throw new RefinementInputError("Enter both existing and proposed seasonal heating efficiencies.");
      gas = heat * (1 - v.existingEfficiencyPct / v.newEfficiencyPct); other = 0;
      notes.push("Heating savings use your heating load × (1 − existing seasonal efficiency ÷ proposed seasonal efficiency). Cooling savings remain modeled.");
    } else if (r.category === "heat_pump" && [v.seasonalCop, v.existingEfficiencyPct, v.heatingCoveragePct, v.heatingTherms].some(x => x != null)) {
      const eta = (v.existingEfficiencyPct ?? existingHeatingEfficiency(original.building.yearBuilt).value * 100) / 100;
      const cop = v.seasonalCop ?? HEAT_PUMP.seasonalCop.value;
      gas = heat * (v.heatingCoveragePct ?? HEAT_PUMP.coverage.value * 100) / 100;
      elec = energy.endUse.coolingKwh * HEAT_PUMP.coolingImprovement.value - gas * 100 * eta / 3.412 / cop;
      other = 0;
      notes.push("Heat-pump electricity is calculated from displaced gas, existing seasonal efficiency and your seasonal COP; added electricity is subtracted from fuel savings. Unspecified operating inputs retain their original assumptions.");
    } else if (r.category === "water_heating" && [v.seasonalCop, v.existingEfficiencyPct, v.heatingTherms].some(x => x != null)) {
      gas = heat; elec = -gas * 100 * ((v.existingEfficiencyPct ?? HPWH.existingEfficiency.value * 100) / 100) / 3.412 / (v.seasonalCop ?? HPWH.cop.value); other = 0;
      notes.push("Water-heater savings subtract heat-pump electricity from displaced gas using the entered seasonal performance inputs.");
    } else if ((r.category === "controls" || r.category === "envelope") && [v.electricReductionPct, v.gasReductionPct, v.heatingTherms].some(x => x != null)) {
      if (r.category === "controls") {
        const defaults = hvacControlsReduction(original.building.yearBuilt);
        elec = (energy.endUse.coolingKwh + energy.endUse.fansKwh) * (v.electricReductionPct ?? defaults.elec * 100) / 100;
        gas = heat * (v.gasReductionPct ?? defaults.gas * 100) / 100;
      } else {
        if (v.gasReductionPct == null) throw new RefinementInputError("Enter the documented envelope heating reduction percentage.");
        gas = heat * v.gasReductionPct / 100; elec = 0;
      }
      other = 0; notes.push("Reduction percentages are your audit/commissioning scenario inputs; unmetered end-use splits remain assumptions.");
    } else if (r.category === "solar" && v.solarKw != null) {
      elec = Math.min(energy.electricityKwh, v.solarKw * original.solar.specificYieldKwhPerKw); gas = 0;
      other = elec * er * (SOLAR.valueFactor.value - 1); sizing.rooftop_solar = v.solarKw;
      notes.push(`Solar size uses your ${v.solarKw} kW proposal with the existing ${original.solar.method} resource estimate. Valuation remains 90% of the electricity rate; purchased-load caps remain. Weather, shading and tariff uncertainty are retained.`);
    } else if (r.category === "storage" && [v.demandReductionKw, v.demandRate, v.billingMonths, v.addedElectricityKwh].some(x => x != null)) {
      if (v.demandReductionKw == null || v.demandRate == null) throw new RefinementInputError("Enter both the supported monthly peak reduction and demand-charge rate.");
      if (v.demandReductionKw > energy.peakDemandKw) throw new RefinementInputError("Demand reduction cannot exceed the property's peak demand.");
      elec = -(v.addedElectricityKwh ?? 0); gas = 0; other = v.demandReductionKw * v.demandRate * (v.billingMonths ?? 12);
      notes.push("Battery savings use the entered billed-peak reduction × demand charge × billing months, less added electricity. Peak reductions must be supported by interval/dispatch analysis; zero added electricity is an explicit simplifying assumption if omitted.");
    }
    if (r.category === "solar" && v.solarKw == null) other = elec * er * (SOLAR.valueFactor.value - 1);
    elec = Math.min(energy.electricityKwh, elec); gas = Math.min(energy.naturalGasTherms, gas);
    const savings = Math.min(energy.annualEnergyCost, elec * er + gas * gr + other);
    const cost = v.quotedCost == null ? r.cost : { low: v.quotedCost, typical: v.quotedCost, high: v.quotedCost, basis: "User-entered installed quote for this scope; not independently verified." };
    const incentive = v.confirmedIncentive ?? (r.estimatedCost > 0 ? cost.typical * r.incentives / r.estimatedCost : 0);
    const fin = computeMeasureFinancials({ projectCost: cost.typical, incentives: incentive, annualSavings: round(savings), lifetimeYears: r.lifetimeYears });
    const lowRatio = r.estimatedAnnualSavings !== 0 ? r.savingsRange.low / r.estimatedAnnualSavings : 0.75;
    const highRatio = r.estimatedAnnualSavings !== 0 ? r.savingsRange.high / r.estimatedAnnualSavings : 1.2;
    const ends = explicitHoursRange ? [explicitHoursRange.low, explicitHoursRange.high] : [savings * lowRatio, savings * highRatio];
    const savingsRange = { low: round(Math.min(...ends)), high: round(Math.min(energy.annualEnergyCost, Math.max(...ends))) };
    if (v.quotedCost != null) notes.push("Installed cost uses your entered quote for this scope, not a narrowed generic market range.");
    if (v.confirmedIncentive != null) notes.push("Incentive amount is user-entered and must be supported by an eligibility/award document.");
    return { ...r, ...(r.category === "lighting" && v.lightingControlsPct === 0 ? { name: "LED Lighting Retrofit (no added controls)" } : {}), cost, estimatedCost: fin.projectCost, annualElectricitySavingsKwh: round(elec), annualGasSavingsTherms: round(gas),
      annualEnergySavingsMMBtu: round((elec * UNIT.kbtuPerKwh + gas * UNIT.kbtuPerTherm) / 1000, 1), estimatedAnnualSavings: fin.annualSavings,
      savingsRange, annualCo2eSavingsTons: round(elec * gridFactor(original.building.state) + gas * EMISSIONS.gasTonsPerTherm, 1),
      incentives: fin.incentives, netCost: fin.netCost, paybackYears: fin.paybackYears, roiPercent: fin.roiPercent, lifetimeSavings: fin.lifetimeSavings,
      includedInPortfolio: r.includedInPortfolio && savings > 0,
      estimateEvidence: { quotedCost: v.quotedCost, confirmedIncentive: v.confirmedIncentive, sizing, notes },
      assumptions: [...r.assumptions, ...notes],
    };
  });
  return { ...original, energy, recommendations: recs, financialSummary: summarizePortfolio(recs, energy) };
}
