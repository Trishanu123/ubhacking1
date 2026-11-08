import { describe, expect, it } from "vitest";
import { zodResponseFormat } from "openai/helpers/zod";
import { canonicalUrl, groundCompanies, priceConclusion } from "./grounding";
import { CompanyResearchSchema, locationLabel, searchLocation, type ResearchCompany } from "./types";

function company(overrides: Partial<ResearchCompany> = {}): ResearchCompany {
  return { name: "Fixture Solar", website: "https://fixture.example", phone: null,
    coverage: "published_local", buildingFit: "published_match", serviceArea: "Buffalo and Erie County",
    services: ["Commercial solar installation"], credentials: [], reason: "Lists commercial solar work and local coverage.",
    sources: ["https://fixture.example/commercial"],
    pricing: { status: "quote_required", low: null, high: null, unit: "unknown", scope: "Quote needed", installed: false, sourceUrl: null, evidence: "No published installed rate" },
    caveats: ["Confirm scope directly."], ...overrides };
}
const input = (...companies: ResearchCompany[]) => ({ summary: "Source-supported providers for this location.", companies });
const ground = (...companies: ResearchCompany[]) => groundCompanies(input(...companies), companies.flatMap(c => c.sources), "Published installed range 2.50 to 3.50 USD per watt; call (716) 555-0123.");
function priced(name: string, low: number, unit: ResearchCompany["pricing"]["unit"] = "per_watt", scope = "Commercial rooftop PV installed") {
  const website = `https://${name}.example`;
  return company({ name, website, sources: [`${website}/pricing`], pricing: { status: "published", low, high: 3.5, unit, scope, installed: true, sourceUrl: `${website}/pricing`, evidence: `Installed rate ${low} to 3.50 USD per watt.` } });
}

describe("live company evidence", () => {
  it("accepts only companies with an actually consulted primary source and deduplicates sites", () => {
    const c = company();
    expect(ground(c, { ...c, name: "Duplicate branch" })).toHaveLength(1);
    expect(groundCompanies(input(c), ["https://unrelated.example"], "")).toEqual([]);
    expect(ground(company({ website: "https://invented.example" }))).toEqual([]);
  });
  it("normalizes tracking parameters but rejects executable and credential-bearing URLs", () => {
    expect(canonicalUrl("https://www.fixture.example/commercial/?utm_source=openai#test")).toBe("https://fixture.example/commercial");
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("https://user:password@fixture.example/")).toBeNull();
  });
  it("keeps a phone only when it is present in research, and rejects nonnumeric phone garbage", () => {
    expect(ground(company({ phone: "(716) 555-0123" }))[0].phone).toBe("(716) 555-0123");
    expect(ground(company({ phone: "(716) 555-9999" }))[0].phone).toBeNull();
    expect(ground(company({ phone: "--- --- ---" }))[0].phone).toBeNull();
  });
  it("downgrades invented amounts, unknown units and unsourced prices to quote required", () => {
    const p = priced("priced", 2.5);
    expect(ground(p)[0].pricing.status).toBe("published");
    expect(ground({ ...p, pricing: { ...p.pricing, low: 1.01 } })[0].pricing.status).toBe("quote_required");
    expect(ground({ ...p, pricing: { ...p.pricing, unit: "unknown" } })[0].pricing.status).toBe("quote_required");
    expect(ground({ ...p, pricing: { ...p.pricing, sourceUrl: "https://other.example/pricing" } })[0].pricing.status).toBe("quote_required");
  });
  it("only compares published installed rates with the same scope, unit, building fit and local coverage", () => {
    const a = priced("alpha", 2.5), b = priced("beta", 3.5);
    expect(priceConclusion(ground(a, b)).companyId).toBe("alpha.example");
    expect(priceConclusion(ground(a)).companyId).toBeNull();
    expect(priceConclusion(ground(a, { ...b, coverage: "nearby_confirm" })).companyId).toBeNull();
    expect(priceConclusion(ground(a, { ...b, buildingFit: "confirm" })).companyId).toBeNull();
    expect(priceConclusion(ground(a, { ...b, pricing: { ...b.pricing, installed: false } })).companyId).toBeNull();
    expect(priceConclusion(ground(a, priced("otherunit", 3.5, "per_kw"))).companyId).toBeNull();
    expect(priceConclusion(ground(a, priced("residential", 3.5, "per_watt", "Residential installation"))).companyId).toBeNull();
  });
  it("does not call flat projects or tied rates the cheapest for the property", () => {
    expect(priceConclusion(ground(priced("aa", 2.5, "flat_project"), priced("bb", 3.5, "flat_project"))).companyId).toBeNull();
    expect(priceConclusion(ground(priced("aa", 2.5), priced("bb", 2.5))).label).toContain("tied");
  });
  it("prioritizes sourced local coverage and relevant building work over uncertain nearby leads", () => {
    const nearby = company({ name: "Nearby", website: "https://nearby.example", sources: ["https://nearby.example/services"], coverage: "nearby_confirm" });
    const result = ground(nearby, company());
    expect(result[0].name).toBe("Fixture Solar");
    expect(result.map(c => c.rank)).toEqual([1, 2]);
  });
  it("uses the entered city/ZIP automatically without sending the street when possible", () => {
    const location = { address: "123 Private Street, Buffalo, NY 14202", city: "Buffalo", state: "NY", zip: "14202" };
    expect(searchLocation(location)).toBe("Buffalo, NY, 14202, USA");
    expect(locationLabel(location)).toBe("Buffalo, NY, 14202");
    expect(searchLocation({ ...location, city: null, zip: null })).not.toContain("Private Street");
    expect(CompanyResearchSchema.safeParse(input(company({ website: "javascript:alert(1)" }))).success).toBe(false);
  });
});

it("keeps structured output compatible with models that reject JSON Schema URI format", () => {
  expect(JSON.stringify(zodResponseFormat(CompanyResearchSchema, "company_research"))).not.toContain('"format":"uri"');
});

it("never presents a directory profile as the company's official website", () => {
  const c = company({ website: "https://energyscout.io/installer/fixture", sources: ["https://energyscout.io/installer/fixture"] });
  expect(ground(c)).toEqual([]);
});
