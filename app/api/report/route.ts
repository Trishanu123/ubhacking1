import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/db/store";
import { DISCLAIMER } from "@/lib/constants";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const analysis = await getAnalysis(body.id);
  if (!analysis) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    printUrl: `/analysis/${analysis.id}?print=1`,
    disclaimer: DISCLAIMER,
    title: `Preliminary retrofit report — ${analysis.building.address}`,
  });
}
