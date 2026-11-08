import type { BuildingType } from "@/lib/types/building";

/**
 * Central, auditable assumption library. Every heuristic used by the engine lives here so it can be
 * reviewed, displayed in the Assumptions panel, and later replaced by calibrated / ML-derived values.
 *
 * Values are approximate planning figures informed by typical U.S. commercial building characteristics
 * (e.g., the shape of CBECS end-use breakdowns). They are NOT measured data for any specific building.
 */

export interface BuildingProfile {
  /** Typical electricity intensity, kWh / sq ft / yr (cold-climate planning value) */
  kwhPerSqFt: number;
  /** Typical natural gas intensity, therms / sq ft / yr (cold-climate planning value) */
  thermsPerSqFt: number;
  /** Typical site EUI used for a preliminary benchmark, kBtu / sq ft / yr */
  typicalEui: number;
  /** Electricity end-use shares (sum ≈ 1) */
  elec: { lighting: number; cooling: number; fans: number; plugOther: number };
  /** Gas end-use shares (sum ≈ 1) */
  gas: { spaceHeating: number; waterHeating: number; other: number };
  /** Annual load factor used to estimate peak demand when not supplied */
  loadFactor: number;
  /** Lighting fixtures per 1,000 sq ft */
  fixturesPer1000SqFt: number;
  /** Whether high-efficiency / heat-pump water heating is typically material */
  significantHotWater: boolean;
  /** Whether occupancy-based ventilation (DCV) is typically applicable */
  dcvApplicable: boolean;
  /** Typical stories when unknown */
  typicalStories: number;
}

export const BUILDING_PROFILES: Record<BuildingType, BuildingProfile> = {
  office: {
    kwhPerSqFt: 13, thermsPerSqFt: 0.45, typicalEui: 90,
    elec: { lighting: 0.3, cooling: 0.15, fans: 0.15, plugOther: 0.4 },
    gas: { spaceHeating: 0.9, waterHeating: 0.07, other: 0.03 },
    loadFactor: 0.4, fixturesPer1000SqFt: 10, significantHotWater: false, dcvApplicable: true, typicalStories: 3,
  },
  retail: {
    kwhPerSqFt: 13, thermsPerSqFt: 0.35, typicalEui: 80,
    elec: { lighting: 0.38, cooling: 0.17, fans: 0.13, plugOther: 0.32 },
    gas: { spaceHeating: 0.88, waterHeating: 0.08, other: 0.04 },
    loadFactor: 0.42, fixturesPer1000SqFt: 12, significantHotWater: false, dcvApplicable: true, typicalStories: 1,
  },
  restaurant: {
    kwhPerSqFt: 38, thermsPerSqFt: 2.2, typicalEui: 330,
    elec: { lighting: 0.12, cooling: 0.14, fans: 0.14, plugOther: 0.6 },
    gas: { spaceHeating: 0.3, waterHeating: 0.25, other: 0.45 },
    loadFactor: 0.45, fixturesPer1000SqFt: 12, significantHotWater: true, dcvApplicable: true, typicalStories: 1,
  },
  warehouse: {
    kwhPerSqFt: 6, thermsPerSqFt: 0.3, typicalEui: 50,
    elec: { lighting: 0.45, cooling: 0.06, fans: 0.09, plugOther: 0.4 },
    gas: { spaceHeating: 0.92, waterHeating: 0.05, other: 0.03 },
    loadFactor: 0.38, fixturesPer1000SqFt: 4, significantHotWater: false, dcvApplicable: false, typicalStories: 1,
  },
  multifamily: {
    kwhPerSqFt: 7, thermsPerSqFt: 0.55, typicalEui: 80,
    elec: { lighting: 0.15, cooling: 0.12, fans: 0.08, plugOther: 0.65 },
    gas: { spaceHeating: 0.65, waterHeating: 0.3, other: 0.05 },
    loadFactor: 0.5, fixturesPer1000SqFt: 6, significantHotWater: true, dcvApplicable: false, typicalStories: 4,
  },
  hotel: {
    kwhPerSqFt: 14, thermsPerSqFt: 0.6, typicalEui: 110,
    elec: { lighting: 0.2, cooling: 0.15, fans: 0.12, plugOther: 0.53 },
    gas: { spaceHeating: 0.55, waterHeating: 0.35, other: 0.1 },
    loadFactor: 0.55, fixturesPer1000SqFt: 8, significantHotWater: true, dcvApplicable: true, typicalStories: 5,
  },
  school: {
    kwhPerSqFt: 9, thermsPerSqFt: 0.5, typicalEui: 75,
    elec: { lighting: 0.32, cooling: 0.12, fans: 0.16, plugOther: 0.4 },
    gas: { spaceHeating: 0.85, waterHeating: 0.1, other: 0.05 },
    loadFactor: 0.33, fixturesPer1000SqFt: 11, significantHotWater: false, dcvApplicable: true, typicalStories: 2,
  },
  healthcare: {
    kwhPerSqFt: 26, thermsPerSqFt: 1.1, typicalEui: 200,
    elec: { lighting: 0.2, cooling: 0.16, fans: 0.2, plugOther: 0.44 },
    gas: { spaceHeating: 0.6, waterHeating: 0.25, other: 0.15 },
    loadFactor: 0.6, fixturesPer1000SqFt: 12, significantHotWater: true, dcvApplicable: true, typicalStories: 3,
  },
  industrial: {
    kwhPerSqFt: 15, thermsPerSqFt: 0.6, typicalEui: 120,
    elec: { lighting: 0.2, cooling: 0.08, fans: 0.12, plugOther: 0.6 },
    gas: { spaceHeating: 0.6, waterHeating: 0.05, other: 0.35 },
    loadFactor: 0.5, fixturesPer1000SqFt: 5, significantHotWater: false, dcvApplicable: false, typicalStories: 1,
  },
  other: {
    kwhPerSqFt: 11, thermsPerSqFt: 0.45, typicalEui: 85,
    elec: { lighting: 0.28, cooling: 0.14, fans: 0.13, plugOther: 0.45 },
    gas: { spaceHeating: 0.85, waterHeating: 0.1, other: 0.05 },
    loadFactor: 0.42, fixturesPer1000SqFt: 9, significantHotWater: false, dcvApplicable: true, typicalStories: 2,
  },
};

/** Default rates used ONLY when neither the user, a bill, nor a rate API provides one. */
export const DEFAULT_RATES = {
  NY: { electricity: 0.15, gas: 1.1 },
  US: { electricity: 0.13, gas: 1.05 },
};

/** Emission factors (approximate, editable). */
export const EMISSIONS = {
  /** EPA: ~0.0053 metric tons CO2 per therm of natural gas combusted */
  gasTonsPerTherm: 0.0053,
  /** Approximate grid factor, metric tons CO2e / kWh (upstate NY grid is relatively low-carbon) */
  elecTonsPerKwhByState: { NY: 0.00012, US: 0.00037 } as Record<string, number>,
};

export const UNIT = {
  kbtuPerKwh: 3.412,
  kbtuPerTherm: 100,
};

/** Default measure lifetimes (years) used for lifetime-savings estimates. */
export const LIFETIMES = {
  lighting: 15,
  controls: 15,
  hvac: 20,
  heat_pump: 18,
  envelope: 25,
  solar: 25,
  storage: 12,
  water_heating: 13,
} as const;

/**
 * Modeled incentive planning assumptions (share of project cost). These are deliberately conservative
 * placeholders to illustrate how incentives affect economics — they are NOT published program values.
 * Actual amounts depend on program rules and must be confirmed with the program administrator.
 */
export const INCENTIVE_PLANNING_RATE = {
  lighting: 0.2,
  controls: 0.15,
  hvac: 0.15,
  heat_pump: 0.25,
  envelope: 0.1,
  solar: 0.1,
  storage: 0.15,
  water_heating: 0.2,
} as const;

/** Portfolio interactive-effects haircut: measures overlap (e.g., controls + new HVAC). */
export const INTERACTIVE_EFFECTS_FACTOR = 0.9;

/** Uncertainty band applied to savings estimates to produce a low–high range. */
export const SAVINGS_UNCERTAINTY = { low: 0.75, high: 1.2 };
