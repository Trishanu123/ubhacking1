import { describe, expect, it } from "vitest";
import { AnalyzeRequestSchema } from "./analysis";

describe("AnalyzeRequestSchema", () => {
  it("accepts a valid custom request", () => {
    const parsed = AnalyzeRequestSchema.safeParse({
      mode: "custom",
      address: "123 Example Street, Buffalo, NY",
      buildingType: "office",
      squareFeet: 25000,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing address", () => {
    const parsed = AnalyzeRequestSchema.safeParse({ mode: "custom", address: "ab" });
    expect(parsed.success).toBe(false);
  });
});
