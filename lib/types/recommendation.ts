import type { Technology, MatchedIncentive } from "./incentive";

export type Priority = "high" | "medium" | "explore";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface CostRange {
  low: number;
  typical: number;
  high: number;
  basis: string;
}

/** One line in a "View calculation" trace. */
export interface CalcStep {
  label: string;
  expression: string;
  result: string;
}

export interface Recommendation {
  id: string;
  category: Technology;
  categoryLabel: string;
  name: string;
  description: string;
  cost: CostRange;
  estimatedCost: number;
  annualElectricitySavingsKwh: number;
  annualGasSavingsTherms: number;
  /** Primary energy savings in MMBtu (site), used for comparisons. */
  annualEnergySavingsMMBtu: number;
  estimatedAnnualSavings: number;
  savingsRange: { low: number; high: number };
  annualCo2eSavingsTons: number;
  /** Modeled incentive dollars (planning assumption, not a program value). */
  incentives: number;
  incentiveBasis: string;
  netCost: number;
  paybackYears: number | null;
  roiPercent: number | null;
  lifetimeYears: number;
  lifetimeSavings: number;
  confidence: ConfidenceLevel;
  priority: Priority;
  priorityReason: string;
  suitabilityScore: number;
  complexity: "low" | "medium" | "high";
  assumptions: string[];
  calculation: CalcStep[];
  reason: string;
  nextStep: string;
  /** Measures that are alternatives to each other; only the best one counts in portfolio totals. */
  alternativeGroup?: string;
  includedInPortfolio: boolean;
  matchedPrograms: Pick<MatchedIncentive, "id" | "name" | "provider" | "sourceUrl">[];
}
