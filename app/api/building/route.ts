import { NextResponse } from "next/server";
import { z } from "zod";
import { getBuildingData } from "@/lib/services/building-data";
import { BUILDING_TYPES } from "@/lib/types/building";

const Query = z.object({
  address: z.string().min(3).max(300),
  buildingType: z.enum(BUILDING_TYPES).optional(),
  squareFeet: z.coerce.number().positive().optional(),
  yearBuilt: z.coerce.number().int().optional(),
  stories: z.coerce.number().int().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.safeParse({
    address: url.searchParams.get("address"),
    buildingType: url.searchParams.get("buildingType") ?? undefined,
    squareFeet: url.searchParams.get("squareFeet") ?? undefined,
    yearBuilt: url.searchParams.get("yearBuilt") ?? undefined,
    stories: url.searchParams.get("stories") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  try {
    const building = await getBuildingData(parsed.data);
    return NextResponse.json({ building });
  } catch {
    return NextResponse.json({ error: "Building lookup failed", building: null }, { status: 200 });
  }
}
