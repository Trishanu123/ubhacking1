import type { BuildingData, DataSource, Provenance } from "./building";
import type { MatchedIncentive } from "./incentive";
import type { ConfidenceLevel, Recommendation } from "./recommendation";
import type { ExtractionResult } from "./utility";
import { z } from "zod";
import { BUILDING_TYPES } from "./building";

/** Validated request body for POST /api/analyze. */
export const AnalyzeRequestSchema = z.object({
  mode: z.enum(["demo", "custom"]).default("custom"),
  address: z.string().trim().min(3, "Address is required").max(300),
  buildingType: z.enum(BUILDING_TYPES).default("office"),
  squareFeet: z.number().positive().max(10_000_000).nullable().optional(),
  yearBuilt: z.number().int().min(1700).max(2100).nullable().optional(),
  stories: z.number().int().min(1).max(200).nullable().optional(),
  utility: z
    .object({
      electricityKwh: z.number().nonnegative().max(1e9).nullable().optional(),
      naturalGasTherms: z.number().nonnegative().max(1e8).nullable().optional(),
      electricityRate: z.number().positive().max(5).nullable().optional(),
      gasRate: z.number().positive().max(20).nullable().optional(),
      peakDemandKw: z.number().nonnegative().max(1e6).nullable().optional(),
      utilityProvider: z.string().max(200).nullable().optional(),
      monthsOfData: z.number().int().min(1).max(24).nullable().optional(),
      /** false = all-electric account; gas use is zero rather than estimated. */
      hasGasService: z.boolean().default(true),
      source: z.enum(["manual", "ai-extracted", "rule-extracted", "demo", "none"]).default("none"),
    })
    .optional(),
  extraction: z.any().optional(),
  lifetimeOverrideYears: z.number().int().min(1).max(50).nullable().optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export interface EnergyBaseline {
  electricityKwh: number;
  naturalGasTherms: number;
  electricityRate: number;
  gasRate: number;
  electricityCost: number;
  gasCost: number;
  annualEnergyCost: number;
  siteEnergyMMBtu: number;
  /** kBtu / sq ft / yr; null without area */
  euiKbtuPerSqFt: number | null;
  electricityKwhPerSqFt: number | null;
  gasThermsPerSqFt: number | null;
  /** Typical-range comparison for the building type; framed as a preliminary benchmark only */
  benchmark: { typicalEui: number; label: string; ratio: number | null } | null;
  peakDemandKw: number;
  peakDemandProvenance: Provenance;
  annualCo2eTons: number;
  provenance: {
    electricityKwh: Provenance;
    naturalGasTherms: Provenance;
    electricityRate: Provenance;
    gasRate: Provenance;
  };
  endUse: {
    lightingKwh: number;
    coolingKwh: number;
    fansKwh: number;
    plugAndOtherKwh: number;
    spaceHeatingTherms: number;
    waterHeatingTherms: number;
    otherGasTherms: number;
  };
  notes: string[];
}

export interface FinancialSummary {
  annualEnergyCost: number;
  potentialAnnualSavings: number;
  savingsRange: { low: number; high: number };
  potentialIncentives: number;
  totalProjectCost: number;
  totalNetCost: number;
  portfolioPaybackYears: number | null;
  bestPaybackYears: number | null;
  bestPaybackMeasure: string | null;
  annualCo2eReductionTons: number;
  percentCostReduction: number;
  postRetrofitAnnualCost: number;
  postRetrofitElectricityKwh: number;
  postRetrofitGasTherms: number;
  interactiveEffectsFactor: number;
  opportunityCount: number;
  cumulative: { year: number; cumulativeNet: number; cumulativeSavings: number }[];
}

export interface PipelineStep {
  key:
    | "building"
    | "utility"
    | "baseline"
    | "solar"
    | "opportunities"
    | "incentives"
    | "financial"
    | "explanation"
    | "persist";
  label: string;
  status: "done" | "fallback" | "skipped" | "error";
  detail: string;
  durationMs: number;
}

export interface Assumption {
  category: string;
  label: string;
  value: string;
}

export interface NextStep {
  title: string;
  detail: string;
}

export interface AIExplanation {
  method: "ai" | "template";
  model?: string;
  summary: string;
  measureRationales: { id: string; rationale: string }[];
  caveats: string[];
  groundingCheck: { passed: boolean; ungroundedNumbers: string[] };
  fallbackReason?: string;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  score: number;
  factors: { label: string; met: boolean; detail: string }[];
}

export interface Analysis {
  id: string;
  createdAt: string;
  mode: "demo" | "custom";
  isDemo: boolean;
  building: BuildingData;
  energy: EnergyBaseline;
  solar: SolarResource;
  recommendations: Recommendation[];
  incentives: MatchedIncentive[];
  financialSummary: FinancialSummary;
  assumptions: Assumption[];
  sources: DataSource[];
  confidence: ConfidenceAssessment;
  nextSteps: NextStep[];
  explanation: AIExplanation;
  pipeline: PipelineStep[];
  extraction: ExtractionResult | null;
  notices: string[];
  debug: { errors: { step: string; message: string }[]; input: unknown };
  disclaimer: string;
  persistence: "supabase" | "local" | "memory";
}

export interface SolarResource {
  method: "pvwatts" | "fallback";
  specificYieldKwhPerKw: number;
  monthlyKwhPerKw: number[] | null;
  tilt: number;
  azimuth: number;
  losses: number;
  note: string;
}
