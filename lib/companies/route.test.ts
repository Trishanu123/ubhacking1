import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/store", () => ({ getAnalysis: vi.fn() }));
vi.mock("@/lib/ai/company-discovery", () => ({ getCompanyDiscovery: vi.fn() }));
import { POST } from "@/app/api/recommendations/companies/route";
import { getAnalysis } from "@/lib/db/store";
import { getCompanyDiscovery } from "@/lib/ai/company-discovery";

const id = "f0c2e7dc-2f06-41c9-97fd-919930e6f93b";
const location = { address: "123 Main Street, Buffalo, NY 14202", city: "Buffalo", state: "NY", zip: "14202" };
const snapshot = { id, createdAt: "2026-11-08T00:00:00.000Z", building: { state: "NY", buildingType: "office", buildingAreaSqFt: 10000, footprintSqFt: 5000, stories: 2 }, energy: { waterHeatingTherms: 100, peakDemandKw: 20 }, solar: { specificYieldKwhPerKw: 1200 }, electricityKwh: 100000, recommendations: [{ id: "solar-pv", name: "Solar", category: "solar", cost: { low: 1, typical: 2, high: 3, basis: "Test" }, estimatedCost: 2, estimatedAnnualSavings: 1, savingsRange: { low: 0.75, high: 1.2 }, annualElectricitySavingsKwh: 10, annualGasSavingsTherms: 0, lifetimeYears: 25, includedInPortfolio: true, suitabilityScore: 0.8, programIds: [] }] };
const body = { analysisId: id, upgradeId: "solar-pv", location, snapshot };
const request = (value: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/recommendations/companies", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.mocked(getAnalysis).mockResolvedValue(null); });
describe("company discovery API", () => {
  it("uses the entered location and selected upgrade without requiring a new county", async () => {
    vi.mocked(getCompanyDiscovery).mockResolvedValue({ method: "ai_web_search", upgradeId: "solar-pv", location: "Buffalo, NY, 14202", searchedAt: snapshot.createdAt, summary: "No supported companies", companies: [], bestMatchId: null, pricing: { companyId: null, label: "Quotes needed", explanation: "No comparable prices" }, sources: [], coverageNote: "Confirm coverage" });
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(getCompanyDiscovery).toHaveBeenCalledWith(snapshot, location, "solar-pv", [], false);
  });
  it("rejects unknown upgrades, mismatched IDs and invalid location", async () => {
    expect((await POST(request({ ...body, upgradeId: "invented" }))).status).toBe(400);
    expect((await POST(request({ ...body, snapshot: { ...snapshot, id: "a0c2e7dc-2f06-41c9-97fd-919930e6f93b" } }))).status).toBe(400);
    expect((await POST(request({ ...body, location: { ...location, address: "" } }))).status).toBe(400);
    expect(getCompanyDiscovery).not.toHaveBeenCalled();
  });
  it("reports missing server configuration instead of pretending to have searched", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request(body))).status).toBe(503);
    expect(getCompanyDiscovery).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and oversized payloads", async () => {
    expect((await POST(request(body, "https://other.example"))).status).toBe(403);
    expect((await POST(request({ filler: "x".repeat(200001) }))).status).toBe(413);
  });
});
