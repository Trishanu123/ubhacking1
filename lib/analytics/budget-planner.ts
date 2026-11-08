import type { EnergyBaseline } from "@/lib/types/analysis";
import type { Recommendation } from "@/lib/types/recommendation";
import { EMISSIONS, INTERACTIVE_EFFECTS_FACTOR, SAVINGS_UNCERTAINTY } from "./assumptions";
import { gridFactor } from "./energy-baseline";

export type BudgetPriority = "bills" | "emissions" | "payback";

export interface BudgetPlan {
  priority: BudgetPriority;
  budget: number;
  selected: Recommendation[];
  upfrontCost: number;
  remainingBudget: number;
  annualSavings: number;
  savingsRange: { low: number; high: number };
  annualElectricitySavingsKwh: number;
  annualGasSavingsTherms: number;
  annualCo2eSavingsTons: number;
  paybackYears: number | null;
  overlapFactor: number;
  evaluatedPackages: number;
}

export const MAX_BUDGET = 1_000_000_000;
const EPSILON = 1e-8;
const cents = (amount: number) => Math.round(amount * 100);
const isHeatingReplacement = (r: Recommendation) => r.category === "hvac" || r.category === "heat_pump";

function compatible(candidate: Recommendation, selected: Recommendation[]) {
  return !selected.some(existing =>
    existing.id === candidate.id ||
    (candidate.alternativeGroup && candidate.alternativeGroup === existing.alternativeGroup) ||
    // Enforce the known heating conflict even on older saved reports without group tags.
    (isHeatingReplacement(candidate) && isHeatingReplacement(existing)),
  );
}

function packageTotals(selected: Recommendation[], energy: EnergyBaseline, state?: string | null) {
  const factor = selected.length > 1 ? INTERACTIVE_EFFECTS_FACTOR : 1;
  const nonSolar = selected.filter(r => r.category !== "solar");
  const rawElectricity = nonSolar.reduce((s, r) => s + r.annualElectricitySavingsKwh, 0) * factor;
  const rawGas = nonSolar.reduce((s, r) => s + r.annualGasSavingsTherms, 0) * factor;
  // Keep negative savings: fuel switching can increase electricity use.
  let electricity = Math.min(energy.electricityKwh, rawElectricity);
  const gas = Math.min(energy.naturalGasTherms, rawGas);
  let savings = nonSolar.reduce((s, r) => s + r.estimatedAnnualSavings, 0) * factor;
  savings -= (rawElectricity - electricity) * energy.electricityRate;
  savings -= (rawGas - gas) * energy.gasRate;

  // Efficiency reduces purchased electricity before solar is applied. Solar cannot
  // offset the same kWh twice; value per kWh retains the existing export/value assumption.
  for (const solar of selected.filter(r => r.category === "solar")) {
    const production = Math.max(0, solar.annualElectricitySavingsKwh);
    const used = Math.min(production * factor, Math.max(0, energy.electricityKwh - electricity));
    electricity += used;
    savings += production > 0 ? used * solar.estimatedAnnualSavings / production : 0;
  }
  savings = Math.min(energy.annualEnergyCost, savings);
  return {
    annualSavings: savings,
    annualElectricitySavingsKwh: electricity,
    annualGasSavingsTherms: gas,
    annualCo2eSavingsTons: Math.min(energy.annualCo2eTons, electricity * gridFactor(state ?? null) + gas * EMISSIONS.gasTonsPerTherm),
    overlapFactor: factor,
  };
}

function improvesGoal(plan: BudgetPlan) {
  return plan.priority === "emissions" ? plan.annualCo2eSavingsTons > EPSILON : plan.annualSavings > EPSILON;
}

function better(candidate: BudgetPlan, current: BudgetPlan) {
  if (!improvesGoal(candidate)) return false;
  if (!current.selected.length) return true;
  const primary = candidate.priority === "bills"
    ? candidate.annualSavings - current.annualSavings
    : candidate.priority === "emissions"
      ? candidate.annualCo2eSavingsTons - current.annualCo2eSavingsTons
      : (current.paybackYears ?? Infinity) - (candidate.paybackYears ?? Infinity);
  if (Math.abs(primary) > EPSILON) return primary > 0;
  // Equal payback favors meaningful savings; equal impact favors the cheaper package.
  if (candidate.priority === "payback" && Math.abs(candidate.annualSavings - current.annualSavings) > EPSILON) {
    return candidate.annualSavings > current.annualSavings;
  }
  if (candidate.upfrontCost !== current.upfrontCost) return candidate.upfrontCost < current.upfrontCost;
  return candidate.selected.length < current.selected.length;
}

/** Exact subset search over the existing screening engine's small list of measures.
 * Existing report totals, ranking and recommendation objects are never mutated.
 */
export function planBudget(
  recommendations: Recommendation[],
  energy: EnergyBaseline,
  budget: number,
  priority: BudgetPriority,
  state?: string | null,
): BudgetPlan {
  if (!Number.isFinite(budget) || budget < 0 || budget > MAX_BUDGET) throw new Error("Enter a budget between $0 and $1,000,000,000.");
  if (!["bills", "emissions", "payback"].includes(priority)) throw new Error("Choose a valid priority.");
  const budgetCents = cents(budget);
  // Portfolio-excluded alternatives remain eligible for this independent budget plan.
  const candidates = recommendations.filter(r => [r.estimatedCost, r.estimatedAnnualSavings, r.annualElectricitySavingsKwh, r.annualGasSavingsTherms].every(Number.isFinite) && r.estimatedCost >= 0 && cents(r.estimatedCost) <= budgetCents);
  if (candidates.length > 20) throw new Error("There are too many upgrade options to compare in this planner.");
  let best: BudgetPlan = {
    priority, budget: budgetCents / 100, selected: [], upfrontCost: 0, remainingBudget: budgetCents / 100,
    annualSavings: 0, savingsRange: { low: 0, high: 0 }, annualElectricitySavingsKwh: 0,
    annualGasSavingsTherms: 0, annualCo2eSavingsTons: 0, paybackYears: null, overlapFactor: 1, evaluatedPackages: 0,
  };
  let evaluatedPackages = 0;
  function visit(start: number, selected: Recommendation[], costCents: number) {
    if (selected.length) {
      evaluatedPackages++;
      const totals = packageTotals(selected, energy, state);
      const cost = costCents / 100;
      const candidate: BudgetPlan = {
        ...totals, priority, budget: budgetCents / 100, selected: [...selected], upfrontCost: cost,
        remainingBudget: (budgetCents - costCents) / 100,
        paybackYears: totals.annualSavings > EPSILON ? cost / totals.annualSavings : null,
        savingsRange: {
          low: totals.annualSavings * (totals.annualSavings >= 0 ? SAVINGS_UNCERTAINTY.low : SAVINGS_UNCERTAINTY.high),
          high: Math.min(energy.annualEnergyCost, totals.annualSavings * (totals.annualSavings >= 0 ? SAVINGS_UNCERTAINTY.high : SAVINGS_UNCERTAINTY.low)),
        },
        evaluatedPackages: 0,
      };
      if (better(candidate, best)) best = candidate;
    }
    for (let i = start; i < candidates.length; i++) {
      const next = candidates[i];
      const nextCost = costCents + cents(next.estimatedCost);
      if (nextCost <= budgetCents && compatible(next, selected)) visit(i + 1, [...selected, next], nextCost);
    }
  }
  visit(0, [], 0);
  return { ...best, evaluatedPackages };
}
