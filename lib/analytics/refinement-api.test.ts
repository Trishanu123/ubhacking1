import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/store", () => ({ getAnalysis: vi.fn(), saveAnalysis: vi.fn(a => Promise.resolve(a)) }));
vi.mock("@/lib/ai/installer-recommendation", () => ({ getInstallerRecommendations: vi.fn() }));
vi.mock("@/lib/ai/company-discovery", () => ({ getCompanyDiscovery: vi.fn() }));
import { getAnalysis } from "@/lib/db/store";
import { getInstallerRecommendations } from "@/lib/ai/installer-recommendation";
import { getCompanyDiscovery } from "@/lib/ai/company-discovery";
import { POST as installerPost } from "@/app/api/recommendations/installers/route";
import { POST as companyPost } from "@/app/api/recommendations/companies/route";
import { runAnalysis } from "./pipeline";
import { demoAnalyzeRequest } from "@/lib/demo/demo-building";
import type { Analysis } from "@/lib/types/analysis";
let analysis: Analysis;
beforeAll(async () => { analysis = await runAnalysis(demoAnalyzeRequest()); vi.mocked(getAnalysis).mockResolvedValue(analysis); }, 30000);
function request(path: string, body: unknown) { return new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
it("recomputes a stored analysis with the same quote/refinements used on the dashboard", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const refinements = { measures: { "solar-pv": { solarKw: 20, quotedCost: 40000, confirmedIncentive: 4000 } } };
  expect((await installerPost(request("/api/recommendations/installers", { analysisId: analysis.id, county: null, refinements }))).status).toBe(200);
  const projected = vi.mocked(getInstallerRecommendations).mock.calls[0][0];
  expect(projected.recommendations.find(r => r.id === "solar-pv")!.estimateEvidence!.quotedCost).toBe(40000);
  expect((await companyPost(request("/api/recommendations/companies", { analysisId: analysis.id, upgradeId: "solar-pv", location: analysis.building, refinements }))).status).toBe(200);
  const companyInput = vi.mocked(getCompanyDiscovery).mock.calls[0][0];
  expect(companyInput).toEqual(projected);
  expect(analysis.recommendations.find(r => r.id === "solar-pv")!.estimateEvidence).toBeUndefined();
  vi.unstubAllEnvs();
});
it("returns an input error for impossible stored-analysis equipment refinements", async () => {
  const response = await installerPost(request("/api/recommendations/installers", { analysisId: analysis.id, county: null, refinements: { measures: { "lighting-led-controls": { fixtureCount: 100 } } } }));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("fixture count");
});
