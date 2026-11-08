import type { BuildingData } from "@/lib/types/building";
import type { EnergyBaseline, SolarResource } from "@/lib/types/analysis";
import type { CalcStep, ConfidenceLevel, CostRange } from "@/lib/types/recommendation";
import type { Technology } from "@/lib/types/incentive";
import { BUILDING_PROFILES, type BuildingProfile } from "./assumptions";

export interface MeasureContext {
  building: BuildingData;
  baseline: EnergyBaseline;
  profile: BuildingProfile;
  solar: SolarResource;
  areaSqFt: number;
  roofAreaSqFt: number;
}

/** Output of a measure module, before incentives and financials are applied. */
export interface MeasureDraft {
  id: string;
  category: Exclude<Technology, "assessment" | "financing">;
  name: string;
  description: string;
  elecKwh: number;
  gasTherms: number;
  /** Additional non-energy-rate dollar savings (e.g., demand charge reduction). */
  extraDollars: number;
  /** Dollar savings computed by the module (energy × rates + extra). */
  annualSavings: number;
  cost: CostRange;
  lifetimeYears: number;
  complexity: "low" | "medium" | "high";
  confidence: ConfidenceLevel;
  /** 0–1 building compatibility from screening rules */
  fit: number;
  fitReasons: string[];
  assumptions: string[];
  calculation: CalcStep[];
  reason: string;
  nextStep: string;
  alternativeGroup?: string;
}

export function makeContext(building: BuildingData, baseline: EnergyBaseline, solar: SolarResource): MeasureContext {
  const profile = BUILDING_PROFILES[building.buildingType];
  const areaSqFt = building.buildingAreaSqFt ?? 0;
  const stories = building.stories ?? profile.typicalStories;
  const roofAreaSqFt = building.footprintSqFt ?? (areaSqFt > 0 ? areaSqFt / Math.max(1, stories) : 0);
  return { building, baseline, profile, solar, areaSqFt, roofAreaSqFt };
}

export const fmt = {
  kwh: (v: number) => `${Math.round(v).toLocaleString("en-US")} kWh`,
  therms: (v: number) => `${Math.round(v).toLocaleString("en-US")} therms`,
  usd: (v: number) => `$${Math.round(v).toLocaleString("en-US")}`,
  pct: (v: number) => `${Math.round(v * 100)}%`,
  rate: (v: number, unit: string) => `$${v.toFixed(v < 1 ? 3 : 2)}/${unit}`,
  num: (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }),
};

export function dollarSavings(ctx: MeasureContext, elecKwh: number, gasTherms: number, extra = 0) {
  return elecKwh * ctx.baseline.electricityRate + gasTherms * ctx.baseline.gasRate + extra;
}
