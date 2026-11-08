import { z } from "zod";

const n = (max: number) => z.number().finite().nonnegative().max(max).optional();
export const MeasureRefinementSchema = z.object({
  quotedCost: n(1e10), confirmedIncentive: n(1e10),
  fixtureCount: z.number().int().positive().max(1e6).optional(), oldWatts: n(10000), newWatts: n(10000),
  annualHours: n(8760), hoursLow: n(8760), hoursHigh: n(8760), lightingControlsPct: n(100),
  heatingTherms: n(1e8), existingEfficiencyPct: z.number().positive().max(100).optional(), newEfficiencyPct: z.number().positive().max(100).optional(),
  seasonalCop: z.number().min(1).max(8).optional(), heatingCoveragePct: n(100),
  electricReductionPct: n(100), gasReductionPct: n(100),
  solarKw: z.number().positive().max(1e6).optional(),
  demandReductionKw: n(1e6), demandRate: n(1000), billingMonths: z.number().int().min(1).max(12).optional(), addedElectricityKwh: n(1e9),
}).strict();
export const AnalysisRefinementsSchema = z.object({
  electricityRate: z.number().positive().max(5).optional(), gasRate: z.number().positive().max(20).optional(),
  measures: z.record(z.string().min(1).max(120), MeasureRefinementSchema).refine(rows => Object.keys(rows).length <= 30, "Too many refinements").default({}),
}).strict();
export type MeasureRefinement = z.infer<typeof MeasureRefinementSchema>;
export type AnalysisRefinements = z.infer<typeof AnalysisRefinementsSchema>;
export const EstimateEvidenceSchema = z.object({
  quotedCost: n(1e10), confirmedIncentive: n(1e10),
  sizing: z.record(z.string().max(60), z.number().finite().nonnegative().max(1e9)),
  notes: z.array(z.string().max(1000)).max(20),
});
export type EstimateEvidence = z.infer<typeof EstimateEvidenceSchema>;
