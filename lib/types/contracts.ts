import type { BuildingType } from "./building";
import type { ConfidenceLevel, Priority } from "./recommendation";
import type { Technology } from "./incentive";

/**
 * Shared contracts between the multi-step intake (Building → Energy) and the
 * Results view. Every dollar figure here comes from the deterministic engine;
 * the UI only formats them.
 */

/** Step 01 — what the user tells us about the building. */
export interface BuildingProfile {
  address: string;
  buildingType: BuildingType;
  squareFeet: number | null;
  yearBuilt: number | null;
  stories: number | null;
}

/** Step 02 — annual utility usage and rates. Null means "unknown, estimate it". */
export interface UtilityData {
  electricityKwh: number | null;
  naturalGasTherms: number | null;
  electricityRate: number | null;
  gasRate: number | null;
  /** false = all-electric account: gas is treated as zero, not estimated. */
  hasGasService: boolean;
  source: "manual" | "ai-extracted" | "rule-extracted" | "demo" | "none";
}

/** One retrofit measure as displayed on a Results card. */
export interface UpgradeMeasure {
  id: string;
  name: string;
  category: Technology;
  categoryLabel: string;
  priority: Priority;
  confidence: ConfidenceLevel;
  annualSavings: number;
  upfrontCost: number;
  incentive: number;
  /** Always upfrontCost − incentive (floored at 0). */
  netCost: number;
  /** Always netCost / annualSavings; null when the measure does not save money. */
  paybackYears: number | null;
  roiPercent: number | null;
  lifetimeYears: number;
  includedInTotals: boolean;
}

/** Glanceable top-line summary rendered by the Results hero and spotlight. */
export interface RetrofitAnalysisResult {
  id: string;
  isDemo: boolean;
  building: BuildingProfile;
  baseline: {
    annualEnergyCost: number;
    electricityKwh: number;
    naturalGasTherms: number;
    hasGas: boolean;
  };
  totals: {
    /** Portfolio savings after the interactive-effects adjustment. */
    annualSavings: number;
    savingsRange: { low: number; high: number };
    /** Fraction of baseline utility cost (0–1). */
    shareOfBaseline: number;
    incentives: number;
    upfrontCost: number;
    netCost: number;
    /** totals.netCost / totals.annualSavings */
    blendedPaybackYears: number | null;
  };
  topPick: { measure: UpgradeMeasure; pitch: string } | null;
  /** All measures except the top pick, in engine priority order. */
  others: UpgradeMeasure[];
}
