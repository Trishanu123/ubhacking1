import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import sharp from "sharp";
import { PhotoInventorySchema, inventoryCounts } from "./types";
import * as vision from "./analyze";
import { POST } from "@/app/api/property-photos/analyze/route";
import { EMPTY_FORM, toAnalyzeRequest } from "@/lib/client/analyze-form";

const inventory = { items: [
  { label: "Lights", count: 5, energySource: "electric" as const, confidence: 0.9 },
  { label: "Gas stove", count: 1, energySource: "gas" as const, confidence: 0.8 },
  { label: "Furnace", count: 1, energySource: "both" as const, confidence: 0.8 },
  { label: "Water heater", count: 1, energySource: "unclear" as const, confidence: 0.4 },
], note: "Water-heater fuel is not visible." };
const request = (body: unknown) => new Request("http://localhost/api/property-photos/analyze", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() }, body: JSON.stringify(body) });

describe("optional photo context", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it("counts both-fuel items once in each fuel group and keeps unclear fuel separate", () => {
    expect(inventoryCounts(inventory)).toEqual({ electric: 6, gas: 2, unclear: 1 });
    expect(inventoryCounts({ items: [], note: "" })).toEqual({ electric: 0, gas: 0, unclear: 0 });
    expect(PhotoInventorySchema.safeParse({ ...inventory, items: [{ ...inventory.items[0], count: -2 }] }).success).toBe(false);
  });
  it("does not send photo context to the existing prediction request", () => {
    const formWithContext = { ...EMPTY_FORM, address: "123 Example Street", photoContext: { inventory, photos: ["data:image/jpeg;base64,PRIVATEPHOTO"] } };
    const payload = JSON.stringify(toAnalyzeRequest("custom", formWithContext, null));
    expect(payload).not.toContain("PRIVATEPHOTO");
    expect(payload).not.toContain("photoContext");
    expect(payload).not.toContain("Lights");
  });
  it("analyzes stripped photos and returns context without any database", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const spy = vi.spyOn(vision, "analyzePropertyPhotos").mockImplementation(async images => {
      const metadata = await sharp(Buffer.from(images[0].split(",")[1], "base64")).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.width).toBeLessThanOrEqual(1280);
      return inventory;
    });
    const bytes = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "white" } }).withMetadata().jpeg().toBuffer();
    const response = await POST(request({ images: [`data:image/jpeg;base64,${bytes.toString("base64")}`] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ inventory });
    expect(spy).toHaveBeenCalledOnce();
  });
  it("fails clearly without a key and rejects invalid or excessive photo input", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request({ images: ["data:image/jpeg;base64,AAAA"] }))).status).toBe(503);
    expect((await POST(request({ images: [] }))).status).toBe(400);
    expect((await POST(request({ images: Array(9).fill("data:image/jpeg;base64,AAAA") }))).status).toBe(400);
    expect((await POST(request({ images: ["https://example.com/image.jpg"] }))).status).toBe(400);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    expect((await POST(request({ images: ["data:image/jpeg;base64,AAAA"] }))).status).toBe(400);
  });
  it("rejects oversized requests and cross-origin submissions", async () => {
    expect((await POST(request({ padding: "x".repeat(2900001) }))).status).toBe(413);
    expect((await POST(new Request("http://localhost/api/property-photos/analyze", { method: "POST", headers: { origin: "https://elsewhere.test" }, body: "{}" }))).status).toBe(403);
  });
});
