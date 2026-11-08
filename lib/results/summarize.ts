import type { Analysis } from "@/lib/types/analysis";
import type { RetrofitAnalysisResult, UpgradeMeasure } from "@/lib/types/contracts";
import type { Recommendation } from "@/lib/types/recommendation";
import { usd, years } from "@/lib/format";

export function toUpgradeMeasure(r: Recommendation): UpgradeMeasure {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    categoryLabel: r.categoryLabel,
    priority: r.priority,
    confidence: r.confidence,
    annualSavings: r.estimatedAnnualSavings,
    upfrontCost: r.estimatedCost,
    incentive: r.incentives,
    netCost: r.netCost,
    paybackYears: r.paybackYears,
    roiPercent: r.roiPercent,
    lifetimeYears: r.lifetimeYears,
    includedInTotals: r.includedInPortfolio,
  };
}

/** One factual sentence explaining why the top pick leads, built only from engine outputs. */
export function pitchFor(pick: UpgradeMeasure, peers: UpgradeMeasure[]): string {
  const viable = peers.filter((m) => m.includedInTotals && m.annualSavings > 0);
  const fastest = viable.every((m) => (m.paybackYears ?? Infinity) >= (pick.paybackYears ?? Infinity));
  const biggest = viable.every((m) => m.annualSavings <= pick.annualSavings);
  const cheapest = viable.every((m) => m.netCost >= pick.netCost);

  const claims: string[] = [];
  if (fastest && pick.paybackYears != null) claims.push(`the fastest payback in the plan (${years(pick.paybackYears)})`);
  if (biggest) claims.push(`the largest annual savings (${usd(pick.annualSavings)}/yr)`);
  if (cheapest && !fastest) claims.push(`the lowest net cost (${usd(pick.netCost)})`);

  if (claims.length) return `Highest-scoring measure for this building, with ${claims.join(" and ")}.`;
  return `Best balance of payback, savings, building fit and confidence — pays back in ${years(pick.paybackYears)}.`;
}

export function summarizeAnalysis(a: Analysis): RetrofitAnalysisResult {
  const fs = a.financialSummary;
  const measures = a.recommendations.map(toUpgradeMeasure);
  const pickIndex = measures.findIndex((m) => m.includedInTotals && m.annualSavings > 0);
  const pick = pickIndex >= 0 ? measures[pickIndex] : null;
  const others = measures.filter((_, i) => i !== pickIndex);

  return {
    id: a.id,
    isDemo: a.isDemo,
    building: {
      address: a.building.address,
      buildingType: a.building.buildingType,
      squareFeet: a.building.buildingAreaSqFt,
      yearBuilt: a.building.yearBuilt,
      stories: a.building.stories,
    },
    baseline: {
      annualEnergyCost: a.energy.annualEnergyCost,
      electricityKwh: a.energy.electricityKwh,
      naturalGasTherms: a.energy.naturalGasTherms,
      hasGas: a.energy.naturalGasTherms > 0,
    },
    totals: {
      annualSavings: fs.potentialAnnualSavings,
      savingsRange: fs.savingsRange,
      shareOfBaseline: fs.percentCostReduction,
      incentives: fs.potentialIncentives,
      upfrontCost: fs.totalProjectCost,
      netCost: fs.totalNetCost,
      blendedPaybackYears: fs.portfolioPaybackYears,
    },
    topPick: pick ? { measure: pick, pitch: pitchFor(pick, others) } : null,
    others,
  };
}
