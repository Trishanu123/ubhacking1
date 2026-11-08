import { EMISSIONS } from "./assumptions";
import type { EnergyBaseline, FinancialSummary } from "@/lib/types/analysis";
import type { Recommendation } from "@/lib/types/recommendation";
import { packageTotals, packageSavingsRange } from "./budget-planner";
import { cumulativeCashflow, round } from "./financial";

/**
 * Portfolio totals apply an interactive-effects haircut because measures overlap
 * (e.g. lighting savings reduce cooling load). Individual measure cards stay unadjusted.
 */
export function summarizePortfolio(recs: Recommendation[], energy: EnergyBaseline): FinancialSummary {
  const included = recs.filter((r) => r.includedInPortfolio);
  const effects = packageTotals(included, energy);
  const potentialAnnualSavings = round(effects.annualSavings);
  const potentialIncentives = round(included.reduce((s, r) => s + r.incentives, 0));
  const totalProjectCost = round(included.reduce((s, r) => s + r.estimatedCost, 0));
  const totalNetCost = round(included.reduce((s, r) => s + r.netCost, 0));
  const elecKwh = effects.annualElectricitySavingsKwh;
  const gasTherms = effects.annualGasSavingsTherms;
  const grid = energy.electricityKwh > 0 ? Math.max(0, (energy.annualCo2eTons - energy.naturalGasTherms * EMISSIONS.gasTonsPerTherm) / energy.electricityKwh) : 0;
  const co2 = Math.min(energy.annualCo2eTons, elecKwh * grid + gasTherms * EMISSIONS.gasTonsPerTherm);

  const paybacks = included
    .filter((r) => r.paybackYears != null && r.estimatedAnnualSavings > 0)
    .sort((a, b) => (a.paybackYears ?? 99) - (b.paybackYears ?? 99));
  const best = paybacks[0];

  const postCost = Math.max(0, energy.annualEnergyCost - potentialAnnualSavings);
  const postElec = Math.max(0, energy.electricityKwh - elecKwh);
  const postGas = Math.max(0, energy.naturalGasTherms - gasTherms);

  return {
    annualEnergyCost: round(energy.annualEnergyCost),
    potentialAnnualSavings,
    savingsRange: (() => { const range = packageSavingsRange(included, energy, effects); return { low: round(range.low), high: round(range.high) }; })(),
    potentialIncentives,
    totalProjectCost,
    totalNetCost,
    portfolioPaybackYears:
      potentialAnnualSavings > 0 ? round(totalNetCost / potentialAnnualSavings, 1) : null,
    bestPaybackYears: best?.paybackYears ?? null,
    bestPaybackMeasure: best?.name ?? null,
    annualCo2eReductionTons: round(co2, 1),
    percentCostReduction: energy.annualEnergyCost > 0 ? round(potentialAnnualSavings / energy.annualEnergyCost, 3) : 0,
    postRetrofitAnnualCost: round(postCost),
    postRetrofitElectricityKwh: round(postElec),
    postRetrofitGasTherms: round(postGas),
    interactiveEffectsFactor: effects.overlapFactor,
    opportunityCount: included.length,
    cumulative: cumulativeCashflow(totalNetCost, potentialAnnualSavings, 10),
  };
}
