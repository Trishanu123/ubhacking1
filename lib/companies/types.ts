import { z } from "zod";
import type { BuildingData } from "@/lib/types/building";

export const LocationSchema = z.object({
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(120).nullable(), state: z.string().trim().max(60).nullable(),
  zip: z.string().trim().max(20).nullable(),
});
export type CompanyLocation = z.infer<typeof LocationSchema>;
export function companyLocation(building: BuildingData): CompanyLocation {
  return LocationSchema.parse(building);
}
export function locationLabel(location: CompanyLocation): string {
  return [location.city, location.state, location.zip].filter(Boolean).join(", ") || location.address;
}
// A city/ZIP is sufficient for service-area research; don't forward a street address when available.
export function searchLocation(location: CompanyLocation): string {
  const zip = location.zip || location.address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  if (location.city || zip) return [location.city, location.state, zip, "USA"].filter(Boolean).join(", ");
  return location.address;
}
// Use plain JSON-schema strings: this model rejects the JSON Schema `uri` format.
// URL protocol/credentials are still validated by Zod and again against web evidence.
const url = z.string().min(8).max(1500).refine(v => {
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password;
  } catch { return false; }
});
export const CompanyResearchSchema = z.object({
  summary: z.string().min(1).max(1800),
  companies: z.array(z.object({
    name: z.string().min(2).max(180), website: url,
    phone: z.string().max(40).nullable(),
    serviceArea: z.string().min(1).max(600),
    coverage: z.enum(["published_local", "nearby_confirm"]),
    buildingFit: z.enum(["published_match", "confirm"]),
    services: z.array(z.string().max(180)).min(1).max(10),
    credentials: z.array(z.string().max(200)).max(8),
    reason: z.string().min(1).max(1000),
    sources: z.array(url).min(1).max(6),
    pricing: z.object({
      status: z.enum(["published", "quote_required"]),
      low: z.number().nonnegative().max(1e9).nullable(), high: z.number().nonnegative().max(1e9).nullable(),
      unit: z.enum(["per_watt", "per_kw", "per_ton", "per_kwh", "per_fixture", "per_sqft", "per_unit", "flat_project", "unknown"]),
      scope: z.string().max(400), installed: z.boolean(),
      sourceUrl: url.nullable(), evidence: z.string().max(800),
    }),
    caveats: z.array(z.string().max(500)).max(8),
  })).max(20),
});
export type ResearchCompany = z.infer<typeof CompanyResearchSchema>["companies"][number];
export type FoundCompany = ResearchCompany & { id: string; rank: number };
export interface CompanySearchResult {
  method: "ai_web_search";
  upgradeId: string;
  location: string;
  searchedAt: string;
  summary: string;
  companies: FoundCompany[];
  bestMatchId: string | null;
  pricing: { companyId: string | null; label: string; explanation: string };
  sources: string[];
  coverageNote: string;
}
export const PRICE_UNITS: Record<ResearchCompany["pricing"]["unit"], string> = {
  per_watt: "/W", per_kw: "/kW", per_ton: "/ton", per_kwh: "/kWh", per_fixture: "/fixture", per_sqft: "/sq ft", per_unit: "/unit", flat_project: " for the published project", unknown: "",
};
