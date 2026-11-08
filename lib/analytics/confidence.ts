import type { ConfidenceAssessment } from "@/lib/types/analysis";
import type { BuildingData, Provenance } from "@/lib/types/building";
import type { EnergyBaseline } from "@/lib/types/analysis";

function isMeasured(p: Provenance | undefined): boolean {
  return p === "user" || p === "ai-extracted" || p === "rule-extracted" || p === "api";
}

export function assessConfidence(building: BuildingData, energy: EnergyBaseline): ConfidenceAssessment {
  const hasGas = energy.naturalGasTherms > 0;
  const factors = [
    {
      label: "Utility consumption",
      met: isMeasured(energy.provenance.electricityKwh) && (!hasGas || isMeasured(energy.provenance.naturalGasTherms)),
      detail: !isMeasured(energy.provenance.electricityKwh)
        ? "Consumption estimated from building characteristics"
        : energy.naturalGasTherms === 0
          ? "Electricity consumption provided or extracted (no gas service)"
          : isMeasured(energy.provenance.naturalGasTherms)
            ? "Electricity and gas consumption provided or extracted"
            : "Electricity provided; gas estimated from building characteristics",
    },
    {
      label: "Utility rates",
      met: isMeasured(energy.provenance.electricityRate) && (!hasGas || isMeasured(energy.provenance.gasRate)),
      detail: isMeasured(energy.provenance.electricityRate)
        ? "Rates provided, extracted, or looked up"
        : "Default regional planning rates used",
    },
    {
      label: "Building floor area",
      met: building.buildingAreaSqFt != null && building.buildingAreaSqFt > 0,
      detail: building.buildingAreaSqFt
        ? `${building.buildingAreaSqFt.toLocaleString()} sq ft (${building.fieldProvenance.buildingAreaSqFt ?? "unknown"})`
        : "Floor area missing",
    },
    {
      label: "Location",
      met: building.latitude != null && building.longitude != null,
      detail: building.latitude != null ? "Geocoded coordinates available" : "Coordinates unavailable",
    },
    {
      label: "Building vintage",
      met: building.yearBuilt != null,
      detail: building.yearBuilt ? `Year built ${building.yearBuilt}` : "Year built unknown",
    },
  ];

  const score = factors.filter((f) => f.met).length / factors.length;
  const level = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
  return { level, score: Math.round(score * 100) / 100, factors };
}
