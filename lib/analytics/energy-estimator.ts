import type { BuildingType } from "@/lib/types/building";
import { BUILDING_PROFILES } from "./assumptions";

/**
 * Transparent heuristic estimator for annual consumption when utility data is missing.
 * Labeled in the UI as "Estimated from building characteristics."
 *
 * Designed behind a small interface so a trained model (e.g., gradient-boosted regression on
 * CBECS microdata) can replace it later without touching the rest of the pipeline.
 */
export interface EnergyEstimatorInput {
  buildingType: BuildingType;
  squareFeet: number;
  yearBuilt: number | null;
  latitude: number | null;
}

export interface EnergyEstimate {
  electricityKwh: number;
  naturalGasTherms: number;
  method: string;
  factors: string[];
}

export interface EnergyEstimator {
  estimate(input: EnergyEstimatorInput): EnergyEstimate;
}

/** Heating multiplier relative to a cold-climate (≈ Buffalo, ~42–43°N) reference. */
export function climateHeatingFactor(latitude: number | null): number {
  if (latitude == null) return 1;
  // Simple, bounded linear proxy for heating degree days by latitude in the continental U.S.
  const f = 1 + (latitude - 42.9) * 0.06;
  return Math.min(1.3, Math.max(0.35, f));
}

export function vintageFactor(yearBuilt: number | null): { gas: number; elec: number; label: string } {
  if (yearBuilt == null) return { gas: 1, elec: 1, label: "Unknown vintage (no adjustment)" };
  if (yearBuilt < 1980) return { gas: 1.15, elec: 1.05, label: "Pre-1980 construction (+15% heating, +5% electric)" };
  if (yearBuilt < 2000) return { gas: 1.05, elec: 1.0, label: "1980–1999 construction (+5% heating)" };
  if (yearBuilt < 2012) return { gas: 0.95, elec: 0.97, label: "2000–2011 construction (−5% heating)" };
  return { gas: 0.85, elec: 0.92, label: "2012+ construction (−15% heating, −8% electric)" };
}

export const heuristicEstimator: EnergyEstimator = {
  estimate({ buildingType, squareFeet, yearBuilt, latitude }) {
    const p = BUILDING_PROFILES[buildingType];
    const climate = climateHeatingFactor(latitude);
    const vintage = vintageFactor(yearBuilt);
    const heatingShare = p.gas.spaceHeating;
    // Only the space-heating share of gas scales with climate.
    const gasClimate = heatingShare * climate + (1 - heatingShare);
    const electricityKwh = squareFeet * p.kwhPerSqFt * vintage.elec;
    const naturalGasTherms = squareFeet * p.thermsPerSqFt * gasClimate * vintage.gas;
    return {
      electricityKwh: Math.round(electricityKwh),
      naturalGasTherms: Math.round(naturalGasTherms),
      method: "Heuristic intensity model (building type × area × climate × vintage)",
      factors: [
        `${p.kwhPerSqFt} kWh/sq ft and ${p.thermsPerSqFt} therms/sq ft typical intensity for ${buildingType}`,
        `Climate heating factor ${climate.toFixed(2)} (latitude proxy)`,
        vintage.label,
      ],
    };
  },
};

export function estimateEnergy(input: EnergyEstimatorInput, estimator: EnergyEstimator = heuristicEstimator) {
  return estimator.estimate(input);
}

/** Estimate floor area when unknown (used only as a last resort; flagged as low confidence). */
export const DEFAULT_AREA_BY_TYPE: Record<BuildingType, number> = {
  office: 25000, retail: 12000, restaurant: 4500, warehouse: 50000, multifamily: 40000,
  hotel: 60000, school: 70000, healthcare: 40000, industrial: 60000, other: 20000,
};
