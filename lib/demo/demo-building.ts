import type { BuildingData } from "@/lib/types/building";
import type { AnalyzeRequest } from "@/lib/types/analysis";
import { source } from "@/lib/sources";

/** Buffalo-area office used for the one-click competition demo. Clearly labeled as demo data. */
export const DEMO_BUILDING: BuildingData = {
  address: "123 Main Street, Buffalo, NY 14202",
  normalizedAddress: "123 Main St, Buffalo, NY 14202",
  latitude: 42.8864,
  longitude: -78.8784,
  state: "NY",
  city: "Buffalo",
  zip: "14202",
  buildingAreaSqFt: 25000,
  footprintSqFt: 8333,
  yearBuilt: 1988,
  stories: 3,
  buildingType: "office",
  parcelId: "DEMO-14202-001",
  heatingFuel: "natural_gas",
  fieldProvenance: {
    address: "demo",
    latitude: "demo",
    longitude: "demo",
    buildingAreaSqFt: "demo",
    footprintSqFt: "demo",
    yearBuilt: "demo",
    stories: "demo",
    buildingType: "demo",
    parcelId: "demo",
    heatingFuel: "demo",
  },
  dataSources: [
    source(
      "Watt demo building (illustrative Buffalo office)",
      "building",
      undefined,
      "Demo / estimated data. Not a real parcel or utility account.",
    ),
  ],
  warnings: [
    "Demo / estimated data — this is an illustrative Buffalo-area commercial office, not a real building record.",
  ],
};

export const DEMO_UTILITY = {
  electricityKwh: 145000,
  naturalGasTherms: 42000,
  electricityRate: 0.15,
  gasRate: 1.1,
  peakDemandKw: 55,
  utilityProvider: "National Grid (demo)",
  monthsOfData: 12,
  hasGasService: true,
  source: "demo" as const,
};

export function demoAnalyzeRequest(): AnalyzeRequest {
  return {
    mode: "demo",
    address: DEMO_BUILDING.address,
    buildingType: "office",
    squareFeet: DEMO_BUILDING.buildingAreaSqFt,
    yearBuilt: DEMO_BUILDING.yearBuilt,
    stories: DEMO_BUILDING.stories,
    utility: DEMO_UTILITY,
  };
}
