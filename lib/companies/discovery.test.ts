import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ web: vi.fn(), extract: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: mocks.web }; chat = { completions: { create: mocks.extract } }; } }));
import { collectSearchEvidence, getCompanyDiscovery } from "@/lib/ai/company-discovery";
import type OpenAI from "openai";
import type { PlanningInput } from "@/lib/wny/types";

const input: PlanningInput = {
  id: "f0c2e7dc-2f06-41c9-97fd-919930e6f93b", createdAt: "2026-11-08T00:00:00.000Z",
  building: { state: "NY", buildingType: "office", buildingAreaSqFt: 10000, footprintSqFt: 5000, stories: 2 }, energy: { waterHeatingTherms: 100, peakDemandKw: 20 }, solar: { specificYieldKwhPerKw: 1200 }, electricityKwh: 100000,
  recommendations: [{ id: "solar-pv", category: "solar", name: "Rooftop Solar PV", cost: { low: 100, typical: 200, high: 300, basis: "test" }, estimatedCost: 200, estimatedAnnualSavings: 50, savingsRange: { low: 40, high: 60 }, annualElectricitySavingsKwh: 400, annualGasSavingsTherms: 0, lifetimeYears: 25, includedInPortfolio: true, suitabilityScore: 0.8, programIds: [] }],
};
const location = { address: "123 Private St, Buffalo, NY 14202", city: "Buffalo", state: "NY", zip: "14202" };
const response = {
  status: "completed", output_text: "Fixture Solar installs commercial solar in Buffalo. Official website https://fixture.example/services. Quotes required.",
  output: [{ type: "web_search_call", status: "completed", action: { type: "search", sources: [{ url: "https://fixture.example/services?utm_source=openai", type: "url" }] } }],
} as unknown as OpenAI.Responses.Response;
const extracted = { summary: "A company with documented commercial services was found.", companies: [{ name: "Fixture Solar", website: "https://fixture.example", phone: null, serviceArea: "Buffalo", coverage: "published_local", buildingFit: "published_match", services: ["Commercial solar"], credentials: [], reason: "Lists the relevant service and city.", sources: ["https://fixture.example/services"], pricing: { status: "quote_required", low: null, high: null, unit: "unknown", scope: "Quote needed", installed: false, sourceUrl: null, evidence: "No published installed price." }, caveats: ["Confirm availability."] }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-fixture-key");
  mocks.web.mockResolvedValue(response);
  mocks.extract.mockResolvedValue({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(extracted) } }] });
});

describe("live discovery service", () => {
  it("requires an actual completed web search and consulted sources", () => {
    expect(collectSearchEvidence(response).sources).toEqual(["https://fixture.example/services"]);
    expect(() => collectSearchEvidence({ ...response, output: [] })).toThrow();
    expect(() => collectSearchEvidence({ ...response, output_text: "" })).toThrow();
  });
  it("uses live evidence, hides the street when city/ZIP exist and caches the same search", async () => {
    const sample = { ...input, id: "a0c2e7dc-2f06-41c9-97fd-919930e6f93b" };
    const first = getCompanyDiscovery(sample, location, "solar-pv");
    expect(getCompanyDiscovery(sample, location, "solar-pv")).toBe(first);
    const result = await first;
    expect(result.companies[0].name).toBe("Fixture Solar");
    expect(result.pricing.companyId).toBeNull();
    expect(mocks.web.mock.calls[0][0].input).not.toContain("Private St");
    expect(mocks.web.mock.calls[0][0].input).toContain("Buffalo");
    expect(mocks.extract).toHaveBeenCalledTimes(1);
  });
  it("does not cache provider failures and lets a retry perform research again", async () => {
    const sample = { ...input, id: "b0c2e7dc-2f06-41c9-97fd-919930e6f93b" };
    mocks.web.mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(getCompanyDiscovery(sample, location, "solar-pv")).rejects.toThrow();
    expect((await getCompanyDiscovery(sample, location, "solar-pv")).companies).toHaveLength(1);
    expect(mocks.web).toHaveBeenCalledTimes(2);
  });
  it("uses a separate widened search and excludes previously found companies", async () => {
    const sample = { ...input, id: "c0c2e7dc-2f06-41c9-97fd-919930e6f93b" };
    expect((await getCompanyDiscovery(sample, location, "solar-pv", ["https://fixture.example"], true)).companies).toEqual([]);
    expect(mocks.web.mock.calls[0][0].input).toContain("Widen");
  });
  it("rejects incomplete or invalid extraction instead of fabricating fallback companies", async () => {
    const sample = { ...input, id: "d0c2e7dc-2f06-41c9-97fd-919930e6f93b" };
    mocks.extract.mockResolvedValueOnce({ choices: [{ finish_reason: "length", message: { content: "{}" } }] });
    await expect(getCompanyDiscovery(sample, location, "solar-pv")).rejects.toThrow();
  });
});
