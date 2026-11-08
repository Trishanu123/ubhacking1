import { z } from "zod";
import { EstimateEvidenceSchema } from "@/lib/types/refinement";
import type { Analysis } from "@/lib/types/analysis";

export const COUNTIES = ["Erie", "Niagara", "Genesee", "Orleans", "Chautauqua", "Wyoming", "Cattaraugus", "Allegany"] as const;
export const CountySchema = z.enum(COUNTIES);
export type County = z.infer<typeof CountySchema>;
export const SYSTEMS = ["led", "lighting_controls", "hvac_controls", "furnace_boiler", "air_source_heat_pump", "ground_source_heat_pump", "air_sealing", "insulation", "windows", "smart_thermostat", "heat_pump_water_heater", "rooftop_solar", "battery_storage"] as const;
export const SystemSchema = z.enum(SYSTEMS);
export type System = z.infer<typeof SystemSchema>;
const amount = z.number().finite().min(-1e12).max(1e12);
const positive = amount.nonnegative();
const range = z.object({ low: positive, typical: positive, high: positive, basis: z.string().max(3000) });
const category = z.enum(["lighting", "controls", "hvac", "heat_pump", "envelope", "solar", "storage", "water_heating", "assessment", "financing"]);
export const PlanningInputSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  building: z.object({
    state: z.string().max(50).nullable(), buildingType: z.enum(["office", "retail", "restaurant", "warehouse", "multifamily", "hotel", "school", "healthcare", "industrial", "other"]),
    buildingAreaSqFt: positive.max(1e7).nullable(), footprintSqFt: positive.max(1e7).nullable(), stories: positive.max(200).nullable(),
  }),
  energy: z.object({ waterHeatingTherms: positive, peakDemandKw: positive }),
  solar: z.object({ specificYieldKwhPerKw: positive }),
  electricityKwh: positive,
  recommendations: z.array(z.object({
    id: z.string().min(1).max(120), name: z.string().max(300), category,
    cost: range, estimatedCost: positive, estimatedAnnualSavings: amount,
    savingsRange: z.object({ low: amount, high: amount }),
    annualElectricitySavingsKwh: amount, annualGasSavingsTherms: amount,
    lifetimeYears: positive.max(100), includedInPortfolio: z.boolean(), suitabilityScore: positive.max(1),
    estimateEvidence: EstimateEvidenceSchema.optional(),
    programIds: z.array(z.string().max(120)).max(50),
  })).max(30),
});
export type PlanningInput = z.infer<typeof PlanningInputSchema>;
export function planningInput(a: Analysis): PlanningInput {
  return PlanningInputSchema.parse({
    id: a.id, createdAt: a.createdAt, building: a.building,
    energy: { waterHeatingTherms: a.energy.endUse.waterHeatingTherms, peakDemandKw: a.energy.peakDemandKw },
    solar: a.solar, electricityKwh: a.energy.electricityKwh,
    recommendations: a.recommendations.map(r => ({ ...r, programIds: r.matchedPrograms.map(p => p.id) })),
  });
}
export interface MoneyRange { low: number; typical: number; high: number }
export interface CostEstimate {
  installed: MoneyRange;
  net: MoneyRange;
  incentives: MoneyRange;
  payback: { low: number | null; typical: number | null; high: number | null };
  components: { catalogId: System; quantity: number; unit: string }[];
  provisional: boolean;
  notes: string[];
  sources: { label: string; url: string; date: string | null; reviewed: string; note: string }[];
}
export type PricedUpgrade = PlanningInput["recommendations"][number] & { systems: System[]; estimate: CostEstimate };
export interface InstallerRank {
  id: string; rank: number; reason: string; priceTier: "budget" | "mid" | "premium" | "unverified";
  match: "strong" | "partial"; caveats: string[];
}
export interface UpgradeAdvice { upgradeId: string; installers: InstallerRank[]; howToChoose: string }
export interface InstallerAdvice {
  method: "ai" | "deterministic";
  model?: string;
  generatedAt: string;
  county: County | null;
  top: { upgradeId: string; reason: string; installerIds: string[] } | null;
  upgrades: UpgradeAdvice[];
  notice: string;
}
