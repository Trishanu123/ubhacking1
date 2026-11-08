import type { BuildingData, Provenance } from "@/lib/types/building";
import type { EnergyBaseline } from "@/lib/types/analysis";
import { BUILDING_PROFILES, EMISSIONS, UNIT } from "./assumptions";

export interface BaselineInput {
  building: BuildingData;
  electricityKwh: number;
  naturalGasTherms: number;
  electricityRate: number;
  gasRate: number;
  peakDemandKw?: number | null;
  provenance: EnergyBaseline["provenance"];
}

export function gridFactor(state: string | null): number {
  return EMISSIONS.elecTonsPerKwhByState[state ?? ""] ?? EMISSIONS.elecTonsPerKwhByState.US;
}

export function computeEui(electricityKwh: number, gasTherms: number, areaSqFt: number | null): number | null {
  if (!areaSqFt || areaSqFt <= 0) return null;
  return (electricityKwh * UNIT.kbtuPerKwh + gasTherms * UNIT.kbtuPerTherm) / areaSqFt;
}

/** Builds the energy baseline. Pure function — no I/O. */
export function computeBaseline(input: BaselineInput): EnergyBaseline {
  const { building } = input;
  const p = BUILDING_PROFILES[building.buildingType];
  const elec = Math.max(0, input.electricityKwh);
  const gas = Math.max(0, input.naturalGasTherms);
  const electricityCost = elec * input.electricityRate;
  const gasCost = gas * input.gasRate;
  const area = building.buildingAreaSqFt;
  const eui = computeEui(elec, gas, area);

  let peakDemandKw = input.peakDemandKw ?? 0;
  let peakDemandProvenance: Provenance = "user";
  if (!peakDemandKw) {
    peakDemandKw = elec / (8760 * p.loadFactor);
    peakDemandProvenance = "estimated";
  }

  const notes: string[] = [];
  let benchmark: EnergyBaseline["benchmark"] = null;
  if (eui != null) {
    const ratio = eui / p.typicalEui;
    const label =
      ratio > 1.3
        ? "Above typical range for this building type (preliminary benchmark)"
        : ratio < 0.75
          ? "Below typical range for this building type (preliminary benchmark)"
          : "Within typical range for this building type (preliminary benchmark)";
    benchmark = { typicalEui: p.typicalEui, label, ratio };
    notes.push(
      "EUI comparison is a preliminary benchmark only; it does not by itself establish that the building is inefficient.",
    );
  } else {
    notes.push("EUI not calculated because building floor area is unavailable.");
  }

  const annualCo2eTons = gas * EMISSIONS.gasTonsPerTherm + elec * gridFactor(building.state);

  return {
    electricityKwh: elec,
    naturalGasTherms: gas,
    electricityRate: input.electricityRate,
    gasRate: input.gasRate,
    electricityCost,
    gasCost,
    annualEnergyCost: electricityCost + gasCost,
    siteEnergyMMBtu: (elec * UNIT.kbtuPerKwh + gas * UNIT.kbtuPerTherm) / 1000,
    euiKbtuPerSqFt: eui,
    electricityKwhPerSqFt: area ? elec / area : null,
    gasThermsPerSqFt: area ? gas / area : null,
    benchmark,
    peakDemandKw,
    peakDemandProvenance,
    annualCo2eTons,
    provenance: input.provenance,
    endUse: {
      lightingKwh: elec * p.elec.lighting,
      coolingKwh: elec * p.elec.cooling,
      fansKwh: elec * p.elec.fans,
      plugAndOtherKwh: elec * p.elec.plugOther,
      spaceHeatingTherms: gas * p.gas.spaceHeating,
      waterHeatingTherms: gas * p.gas.waterHeating,
      otherGasTherms: gas * p.gas.other,
    },
    notes,
  };
}
