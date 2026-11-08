export const BUILDING_TYPES = [
  "office",
  "retail",
  "restaurant",
  "warehouse",
  "multifamily",
  "hotel",
  "school",
  "healthcare",
  "industrial",
  "other",
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  office: "Office",
  retail: "Retail",
  restaurant: "Restaurant",
  warehouse: "Warehouse",
  multifamily: "Multifamily",
  hotel: "Hotel",
  school: "School",
  healthcare: "Healthcare",
  industrial: "Industrial",
  other: "Other",
};

/** Where a data point came from. Drives the provenance badges in the UI. */
export type Provenance =
  | "user"
  | "ai-extracted"
  | "rule-extracted"
  | "api"
  | "estimated"
  | "demo"
  | "default";

export interface DataSource {
  name: string;
  url?: string;
  retrievedAt: string;
  category: "building" | "utility" | "solar" | "incentive" | "methodology" | "rates" | "emissions";
  note?: string;
}

export interface BuildingData {
  address: string;
  normalizedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  buildingAreaSqFt: number | null;
  footprintSqFt: number | null;
  yearBuilt: number | null;
  stories: number | null;
  buildingType: BuildingType;
  parcelId: string | null;
  heatingFuel: "natural_gas" | "electric" | "oil" | "unknown";
  fieldProvenance: Partial<Record<keyof BuildingData, Provenance>>;
  dataSources: DataSource[];
  warnings: string[];
}

export interface BuildingDataProvider {
  readonly name: string;
  getBuildingData(input: BuildingLookupInput): Promise<BuildingData>;
}

export interface BuildingLookupInput {
  address: string;
  buildingType?: BuildingType;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  stories?: number | null;
}
