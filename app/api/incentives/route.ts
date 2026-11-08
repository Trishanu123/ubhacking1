import { NextResponse } from "next/server";
import { z } from "zod";
import { findIncentives } from "@/lib/services/incentives";

const Query = z.object({
  state: z.string().nullable().optional(),
  utility: z.string().nullable().optional(),
  buildingType: z.string().default("office"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.parse({
    state: url.searchParams.get("state"),
    utility: url.searchParams.get("utility"),
    buildingType: url.searchParams.get("buildingType") ?? "office",
  });
  const incentives = await findIncentives({
    state: parsed.state ?? "NY",
    utility: parsed.utility ?? null,
    buildingType: parsed.buildingType,
    technologies: ["lighting", "controls", "hvac", "heat_pump", "envelope", "solar", "storage", "water_heating", "assessment", "financing"],
  });
  return NextResponse.json({ incentives });
}
