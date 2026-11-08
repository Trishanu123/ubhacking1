import { z } from "zod";

/**
 * Schema for AI (or rule-based) utility-bill extraction output.
 * Every numeric field is nullable: if a value is not visible, it must be null — never inferred.
 */
export const UtilityBillSchema = z.object({
  utilityProvider: z.string().nullable(),
  accountType: z.string().nullable(),
  billingPeriod: z.string().nullable(),
  billingPeriodMonths: z.number().positive().max(24).nullable(),
  electricityKwh: z.number().nonnegative().nullable(),
  electricityUnits: z.string().nullable(),
  peakDemandKw: z.number().nonnegative().nullable(),
  naturalGasTherms: z.number().nonnegative().nullable(),
  gasUnits: z.string().nullable(),
  electricityCost: z.number().nonnegative().nullable(),
  gasCost: z.number().nonnegative().nullable(),
  deliveryCharges: z.number().nonnegative().nullable(),
  supplyCharges: z.number().nonnegative().nullable(),
  totalBill: z.number().nonnegative().nullable(),
  electricityRate: z.number().nonnegative().max(5).nullable(),
  gasRate: z.number().nonnegative().max(20).nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export type UtilityBillExtraction = z.infer<typeof UtilityBillSchema>;

export interface ExtractionResult {
  method: "ai" | "rule-based" | "demo";
  model?: string;
  fileName: string;
  extraction: UtilityBillExtraction;
  /** Values normalized to annual figures, ready for the baseline engine. */
  annualized: {
    electricityKwh: number | null;
    naturalGasTherms: number | null;
    electricityRate: number | null;
    gasRate: number | null;
    totalAnnualCost: number | null;
    annualizationFactor: number | null;
  };
  storagePath?: string | null;
  notices: string[];
}
