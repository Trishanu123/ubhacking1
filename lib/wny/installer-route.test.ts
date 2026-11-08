import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/store", () => ({ getAnalysis: vi.fn() }));
vi.mock("@/lib/ai/installer-recommendation", () => ({ getInstallerRecommendations: vi.fn() }));
import { POST } from "@/app/api/recommendations/installers/route";
import { getAnalysis } from "@/lib/db/store";
import { getInstallerRecommendations } from "@/lib/ai/installer-recommendation";
const id = "f0c2e7dc-2f06-41c9-97fd-919930e6f93b";
const snapshot = { id, createdAt: "2026-11-08T00:00:00.000Z", building: { state: "NY", buildingType: "office", buildingAreaSqFt: 10000, footprintSqFt: 5000, stories: 2 }, energy: { waterHeatingTherms: 100, peakDemandKw: 20 }, solar: { specificYieldKwhPerKw: 1200 }, electricityKwh: 100000, recommendations: [] };
function request(body: unknown, origin = "http://localhost:3002") {
  return new Request("http://localhost:3002/api/recommendations/installers", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAnalysis).mockResolvedValue(null);
  vi.mocked(getInstallerRecommendations).mockResolvedValue({ method: "deterministic", generatedAt: snapshot.createdAt, county: "Erie", top: null, upgrades: [], notice: "Not AI-ranked" });
});
describe("installer API", () => {
  it("accepts a bounded session snapshot and never requires a database write", async () => {
    const response = await POST(request({ analysisId: id, county: "Erie", snapshot }));
    expect(response.status).toBe(200);
    expect((await response.json()).advice.method).toBe("deterministic");
    expect(getInstallerRecommendations).toHaveBeenCalledWith(snapshot, "Erie");
  });
  it("rejects unsupported counties and mismatched session IDs", async () => {
    expect((await POST(request({ analysisId: id, county: "Queens", snapshot }))).status).toBe(400);
    expect((await POST(request({ analysisId: id, county: null, snapshot: { ...snapshot, id: "e0c2e7dc-2f06-41c9-97fd-919930e6f93b" } }))).status).toBe(400);
    expect(getInstallerRecommendations).not.toHaveBeenCalled();
  });
  it("returns a clear missing-analysis error when neither storage nor snapshot is available", async () => {
    expect((await POST(request({ analysisId: id, county: null }))).status).toBe(404);
  });
  it("rejects cross-origin and oversized input before calling GPT", async () => {
    expect((await POST(request({ analysisId: id, county: null }, "https://other.example"))).status).toBe(403);
    expect((await POST(request({ text: "x".repeat(180001) }))).status).toBe(413);
    expect(getInstallerRecommendations).not.toHaveBeenCalled();
  });
  it("returns a safe error without leaking provider or database details", async () => {
    vi.mocked(getAnalysis).mockRejectedValue(new Error("sensitive internal detail"));
    const response = await POST(request({ analysisId: id, county: null, snapshot }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  });
});
