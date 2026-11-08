import { NextResponse } from "next/server";
import { z } from "zod";
import { computeMeasureFinancials } from "@/lib/analytics/financial";

const Body = z.object({
  projectCost: z.number(),
  incentives: z.number().default(0),
  annualSavings: z.number(),
  lifetimeYears: z.number().default(15),
});

export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ result: computeMeasureFinancials(parsed.data) });
  } catch {
    return NextResponse.json({ error: "Calculation failed" }, { status: 500 });
  }
}
