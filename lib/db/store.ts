import type { Analysis } from "@/lib/types/analysis";
import { getSupabaseAdmin, supabaseConfigured } from "./supabase";

const memory = new Map<string, Analysis>();

export async function saveAnalysis(analysis: Analysis): Promise<Analysis> {
  memory.set(analysis.id, analysis);
  if (!supabaseConfigured()) {
    analysis.persistence = "memory";
    return analysis;
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    analysis.persistence = "memory";
    return analysis;
  }
  try {
    const b = analysis.building;
    const { data: buildingRow, error: bErr } = await sb
      .from("buildings")
      .insert({
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        building_type: b.buildingType,
        square_feet: b.buildingAreaSqFt,
        year_built: b.yearBuilt,
        stories: b.stories,
        parcel_id: b.parcelId,
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    const { error: aErr } = await sb.from("analyses").insert({
      id: analysis.id,
      building_id: buildingRow.id,
      status: "complete",
      annual_electricity_kwh: analysis.energy.electricityKwh,
      annual_gas_therms: analysis.energy.naturalGasTherms,
      annual_energy_cost: analysis.energy.annualEnergyCost,
      estimated_eui: analysis.energy.euiKbtuPerSqFt,
      confidence: analysis.confidence.level,
      payload: analysis,
    });
    if (aErr) throw aErr;

    if (analysis.recommendations.length) {
      await sb.from("recommendations").insert(
        analysis.recommendations.map((r) => ({
          analysis_id: analysis.id,
          category: r.category,
          name: r.name,
          estimated_cost: r.estimatedCost,
          annual_savings: r.estimatedAnnualSavings,
          energy_savings: r.annualEnergySavingsMMBtu,
          incentives: r.incentives,
          net_cost: r.netCost,
          payback_years: r.paybackYears,
          roi_percent: r.roiPercent,
          confidence: r.confidence,
          assumptions: r.assumptions,
          next_step: r.nextStep,
        })),
      );
    }
    if (analysis.sources.length) {
      await sb.from("sources").insert(
        analysis.sources.map((s) => ({
          analysis_id: analysis.id,
          name: s.name,
          url: s.url ?? null,
          category: s.category,
          retrieved_at: s.retrievedAt,
        })),
      );
    }
    analysis.persistence = "supabase";
  } catch (err) {
    analysis.persistence = "memory";
    const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "unknown";
    analysis.debug.errors.push({
      step: "persist",
      message: `Supabase persist failed (${message}). Run supabase/schema.sql in the Supabase SQL editor. Analysis kept in this session.`,
    });
  }
  return analysis;
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("analyses").select("payload").eq("id", id).maybeSingle();
  if (error || !data?.payload) return null;
  const analysis = data.payload as Analysis;
  memory.set(id, analysis);
  return analysis;
}
