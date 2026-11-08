/**
 * Transparent savings-percentage assumptions. Each function returns the percentage used plus the
 * human-readable rationale so it can be stored in `assumptions[]` and shown in "View calculation".
 */

export interface SavingsFactor {
  value: number;
  rationale: string;
}

export function ledReduction(yearBuilt: number | null): SavingsFactor {
  if (yearBuilt == null || yearBuilt < 2010)
    return { value: 0.5, rationale: "Assumed 50% lighting energy reduction from LED retrofit of legacy fluorescent/HID fixtures (lighting inventory not verified)." };
  if (yearBuilt < 2018)
    return { value: 0.35, rationale: "Assumed 35% reduction; building may already have partially efficient lighting." };
  return { value: 0.15, rationale: "Assumed 15% reduction; post-2018 buildings commonly already use LED." };
}

export const LIGHTING_CONTROLS_REDUCTION: SavingsFactor = {
  value: 0.2,
  rationale: "Assumed additional 20% reduction of remaining lighting energy from occupancy/daylight controls.",
};

export function hvacControlsReduction(yearBuilt: number | null): { elec: number; gas: number; rationale: string } {
  if (yearBuilt != null && yearBuilt >= 2012)
    return { elec: 0.05, gas: 0.05, rationale: "Assumed 5% HVAC electricity and 5% heating reduction (newer building likely has some controls)." };
  return {
    elec: 0.1,
    gas: 0.08,
    rationale: "Assumed 10% HVAC electricity and 8% space-heating reduction from scheduling, setbacks, resets and retro-commissioning.",
  };
}

export function existingHeatingEfficiency(yearBuilt: number | null): SavingsFactor {
  if (yearBuilt == null) return { value: 0.78, rationale: "Existing heating efficiency assumed 78% (unknown equipment)." };
  if (yearBuilt < 1990) return { value: 0.75, rationale: "Existing heating efficiency assumed 75% (older non-condensing equipment typical for vintage)." };
  if (yearBuilt < 2005) return { value: 0.8, rationale: "Existing heating efficiency assumed 80%." };
  return { value: 0.85, rationale: "Existing heating efficiency assumed 85%." };
}

export const NEW_HEATING_EFFICIENCY: SavingsFactor = {
  value: 0.92,
  rationale: "New high-efficiency (condensing) heating assumed 92% seasonal efficiency; actual depends on return-water temperature and controls.",
};

export function coolingImprovement(yearBuilt: number | null): SavingsFactor {
  if (yearBuilt == null || yearBuilt < 2005)
    return { value: 0.2, rationale: "Assumed 20% cooling energy reduction from high-efficiency replacement equipment." };
  return { value: 0.1, rationale: "Assumed 10% cooling energy reduction (existing equipment is relatively recent)." };
}

export const HEAT_PUMP = {
  coverage: { value: 0.7, rationale: "Hybrid configuration: heat pumps assumed to serve 70% of annual heating load with existing gas as backup in the coldest hours." },
  seasonalCop: { value: 2.7, rationale: "Seasonal COP of 2.7 assumed for cold-climate air-source heat pumps in a heating-dominated climate." },
  coolingImprovement: { value: 0.15, rationale: "Assumed 15% cooling energy reduction (heat pump also provides cooling)." },
};

export function envelopeReduction(yearBuilt: number | null): SavingsFactor | null {
  if (yearBuilt == null) return { value: 0.07, rationale: "Assumed 7% space-heating reduction from air sealing/insulation (vintage unknown — assessment recommended)." };
  if (yearBuilt < 1980) return { value: 0.1, rationale: "Assumed 10% space-heating reduction from air sealing and roof insulation (pre-1980 envelope)." };
  if (yearBuilt < 2000) return { value: 0.06, rationale: "Assumed 6% space-heating reduction from air sealing and targeted insulation." };
  return null;
}

export const HPWH = {
  existingEfficiency: { value: 0.8, rationale: "Existing gas water heating assumed 80% efficient." },
  cop: { value: 3.0, rationale: "Heat pump water heater average COP assumed 3.0." },
};

export const SOLAR = {
  usableRoofFraction: { value: 0.6, rationale: "60% of roof area assumed usable after setbacks, rooftop equipment and shading." },
  wattsPerSqFt: { value: 11, rationale: "Power density of 11 W-dc per usable sq ft (ballasted, tilted rows with spacing)." },
  valueFactor: { value: 0.9, rationale: "Generation valued at 90% of blended electricity rate (demand charges and export compensation are not fully offset)." },
  maxOffset: { value: 1.0, rationale: "System capped at ~100% of annual electricity consumption." },
  degradation: 0.005,
};

export const STORAGE = {
  demandShareOfBill: { value: 0.3, rationale: "Demand charges assumed to be ~30% of the electricity bill when tariff details are unavailable." },
  peakReduction: { value: 0.2, rationale: "Battery assumed to shave ~20% of monthly peak demand (simplified, not a dispatch optimization)." },
  sizingFractionOfPeak: 0.3,
  durationHours: 2,
};
