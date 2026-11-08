import type { EnergyBaseline, FinancialSummary } from "@/lib/types/analysis";
import type { Recommendation } from "@/lib/types/recommendation";
import { INTERACTIVE_EFFECTS_FACTOR } from "./assumptions";
import { cumulativeCashflow, round } from "./financial";

/**
 * Portfolio totals apply an interactive-effects haircut because measures overlap
 * (e.g. lighting savings reduce cooling load). Individual measure cards stay unadjusted.
 */
export function summarizePortfolio(recs: Recommendation[], energy: EnergyBaseline): FinancialSummary {
  const included = recs.filter((r) => r.includedInPortfolio);
  const factor = INTERACTIVE_EFFECTS_FACTOR;
  const rawSavings = included.reduce((s, r) => s + r.estimatedAnnualSavings, 0);
  const potentialAnnualSavings = round(rawSavings * factor);
  const potentialIncentives = round(included.reduce((s, r) => s + r.incentives, 0));
  const totalProjectCost = round(included.reduce((s, r) => s + r.estimatedCost, 0));
  const totalNetCost = round(included.reduce((s, r) => s + r.netCost, 0));
  const elecKwh = included.reduce((s, r) => s + Math.max(0, r.annualElectricitySavingsKwh), 0) * factor;
  const gasTherms = included.reduce((s, r) => s + r.annualGasSavingsTherms, 0) * factor;
  const co2 = included.reduce((s, r) => s + r.annualCo2eSavingsTons, 0) * factor;

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
    savingsRange: {
      low: round(potentialAnnualSavings * 0.75),
      high: round(potentialAnnualSavings * 1.2),
    },
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
    interactiveEffectsFactor: factor,
    opportunityCount: included.length,
    cumulative: cumulativeCashflow(totalNetCost, potentialAnnualSavings, 10),
  };
}
