import type { BuildingData, BuildingDataProvider, BuildingLookupInput, BuildingType } from "@/lib/types/building";
import { BUILDING_TYPES } from "@/lib/types/building";
import { source } from "@/lib/sources";
import { DEMO_BUILDING } from "@/lib/demo/demo-building";

function emptyBuilding(input: BuildingLookupInput): BuildingData {
  return {
    address: input.address,
    normalizedAddress: null,
    latitude: null,
    longitude: null,
    state: inferState(input.address),
    city: null,
    zip: inferZip(input.address),
    buildingAreaSqFt: input.squareFeet ?? null,
    footprintSqFt: null,
    yearBuilt: input.yearBuilt ?? null,
    stories: input.stories ?? null,
    buildingType: input.buildingType ?? "office",
    parcelId: null,
    heatingFuel: "unknown",
    fieldProvenance: {
      buildingType: input.buildingType ? "user" : "default",
      buildingAreaSqFt: input.squareFeet ? "user" : undefined,
      yearBuilt: input.yearBuilt ? "user" : undefined,
      stories: input.stories ? "user" : undefined,
    },
    dataSources: [],
    warnings: [],
  };
}

export function inferState(address: string): string | null {
  const m = address.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function inferZip(address: string): string | null {
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; state?: string; postcode?: string };
}

export class NominatimBuildingProvider implements BuildingDataProvider {
  readonly name = "nominatim-openstreetmap";

  async getBuildingData(input: BuildingLookupInput): Promise<BuildingData> {
    const building = emptyBuilding(input);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", input.address);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Watt/1.0 (AI for Good competition; contact: local-dev)",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
    const hits = (await res.json()) as NominatimHit[];
    const hit = hits[0];
    if (!hit) {
      building.warnings.push("Address could not be geocoded. Using the information you provided.");
      return building;
    }
    building.latitude = Number(hit.lat);
    building.longitude = Number(hit.lon);
    building.normalizedAddress = hit.display_name;
    building.city = hit.address?.city ?? hit.address?.town ?? hit.address?.village ?? null;
    building.zip = hit.address?.postcode ?? building.zip;
    if (hit.address?.state === "New York") building.state = "NY";
    building.fieldProvenance.latitude = "api";
    building.fieldProvenance.longitude = "api";
    building.dataSources.push(
      source("OpenStreetMap Nominatim", "building", "https://nominatim.org/", "Geocoded coordinates"),
    );
    return building;
  }
}

export class DemoBuildingDataProvider implements BuildingDataProvider {
  readonly name = "demo";
  async getBuildingData(_input?: BuildingLookupInput): Promise<BuildingData> {
    return structuredClone(DEMO_BUILDING);
  }
}

export class CompositeBuildingDataProvider implements BuildingDataProvider {
  readonly name = "composite";
  constructor(private inner: BuildingDataProvider) {}

  async getBuildingData(input: BuildingLookupInput): Promise<BuildingData> {
    let building: BuildingData;
    try {
      building = await this.inner.getBuildingData(input);
    } catch {
      building = emptyBuilding(input);
      building.warnings.push("Live building data was unavailable. We used the information you provided.");
    }
    if (input.squareFeet) {
      building.buildingAreaSqFt = input.squareFeet;
      building.fieldProvenance.buildingAreaSqFt = "user";
    }
    if (input.yearBuilt) {
      building.yearBuilt = input.yearBuilt;
      building.fieldProvenance.yearBuilt = "user";
    }
    if (input.stories) {
      building.stories = input.stories;
      building.fieldProvenance.stories = "user";
    }
    if (input.buildingType) {
      building.buildingType = input.buildingType;
      building.fieldProvenance.buildingType = "user";
    }
    if (!building.buildingAreaSqFt) {
      building.warnings.push("Floor area was not found in public data. Enter square footage for a stronger analysis.");
    }
    if (building.buildingAreaSqFt && building.stories) {
      building.footprintSqFt = Math.round(building.buildingAreaSqFt / Math.max(1, building.stories));
      building.fieldProvenance.footprintSqFt = building.fieldProvenance.footprintSqFt ?? "estimated";
    }
    if (building.heatingFuel === "unknown") {
      building.heatingFuel = "natural_gas";
      building.fieldProvenance.heatingFuel = "default";
      building.warnings.push("Heating fuel was not observed. Natural gas heating is assumed for this climate unless you specify otherwise.");
    }
    return building;
  }
}

export function parseBuildingType(value: string | null | undefined): BuildingType {
  if (value && (BUILDING_TYPES as readonly string[]).includes(value)) return value as BuildingType;
  return "office";
}

export async function getBuildingData(input: BuildingLookupInput): Promise<BuildingData> {
  const provider = new CompositeBuildingDataProvider(new NominatimBuildingProvider());
  return provider.getBuildingData(input);
}
