import OpenAI from "openai";
import { UtilityBillSchema, type ExtractionResult, type UtilityBillExtraction } from "@/lib/types/utility";

const EXTRACTION_PROMPT = `You are extracting structured data from a commercial utility bill. Only return information visible in the document. Never infer missing numerical values. If a field is unavailable, return null. Distinguish electricity consumption from cost and distinguish natural gas consumption from cost. Include a confidence score and warnings.

Return JSON matching this schema:
{
  "utilityProvider": string | null,
  "accountType": string | null,
  "billingPeriod": string | null,
  "billingPeriodMonths": number | null,
  "electricityKwh": number | null,
  "electricityUnits": string | null,
  "peakDemandKw": number | null,
  "naturalGasTherms": number | null,
  "gasUnits": string | null,
  "electricityCost": number | null,
  "gasCost": number | null,
  "deliveryCharges": number | null,
  "supplyCharges": number | null,
  "totalBill": number | null,
  "electricityRate": number | null,
  "gasRate": number | null,
  "confidence": number,
  "warnings": string[]
}

If usage is for a single month, do not annualize it — report the period as shown and set billingPeriodMonths accordingly.`;

function emptyExtraction(warnings: string[]): UtilityBillExtraction {
  return {
    utilityProvider: null,
    accountType: null,
    billingPeriod: null,
    billingPeriodMonths: null,
    electricityKwh: null,
    electricityUnits: null,
    peakDemandKw: null,
    naturalGasTherms: null,
    gasUnits: null,
    electricityCost: null,
    gasCost: null,
    deliveryCharges: null,
    supplyCharges: null,
    totalBill: null,
    electricityRate: null,
    gasRate: null,
    confidence: 0,
    warnings,
  };
}

export function annualize(extraction: UtilityBillExtraction) {
  const months = extraction.billingPeriodMonths && extraction.billingPeriodMonths > 0 ? extraction.billingPeriodMonths : null;
  const factor = months ? 12 / months : null;
  const scale = (v: number | null) => (v == null || factor == null ? v : v * factor);
  let electricityRate = extraction.electricityRate;
  if (electricityRate == null && extraction.electricityKwh && extraction.electricityCost && extraction.electricityKwh > 0) {
    electricityRate = extraction.electricityCost / extraction.electricityKwh;
  }
  let gasRate = extraction.gasRate;
  if (gasRate == null && extraction.naturalGasTherms && extraction.gasCost && extraction.naturalGasTherms > 0) {
    gasRate = extraction.gasCost / extraction.naturalGasTherms;
  }
  const elecAnnual = scale(extraction.electricityKwh);
  const gasAnnual = scale(extraction.naturalGasTherms);
  const costAnnual =
    extraction.totalBill != null && factor != null
      ? extraction.totalBill * factor
      : elecAnnual != null && gasAnnual != null && electricityRate != null && gasRate != null
        ? elecAnnual * electricityRate + gasAnnual * gasRate
        : null;
  return {
    electricityKwh: elecAnnual,
    naturalGasTherms: gasAnnual,
    electricityRate,
    gasRate,
    totalAnnualCost: costAnnual,
    annualizationFactor: factor,
  };
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  return JSON.parse(raw);
}

export async function extractWithOpenAI(file: { bytes: Buffer; mime: string; fileName: string }): Promise<ExtractionResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const isImage = file.mime.startsWith("image/");
  const dataUrl = `data:${file.mime};base64,${file.bytes.toString("base64")}`;

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: EXTRACTION_PROMPT }];
  if (isImage) {
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  } else {
    content.push({
      type: "text",
      text: `The uploaded file is named "${file.fileName}" (${file.mime}, ${file.bytes.length} bytes). If you cannot read the binary PDF contents from this message, return nulls and warn that the document could not be parsed. Do not invent numbers.`,
    });
  }

  // PDFs: use the Responses API file input when possible.
  let text: string;
  if (file.mime === "application/pdf") {
    const uploaded = await client.files.create({
      file: await OpenAI.toFile(file.bytes, file.fileName, { type: file.mime }),
      purpose: "user_data",
    });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: EXTRACTION_PROMPT },
            { type: "input_file", file_id: uploaded.id },
          ],
        },
      ],
    });
    text = response.output_text ?? "";
  } else {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
      temperature: 0,
    });
    text = completion.choices[0]?.message?.content ?? "{}";
  }

  const parsed = UtilityBillSchema.safeParse(parseModelJson(text));
  if (!parsed.success) {
    return {
      method: "ai",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      fileName: file.fileName,
      extraction: emptyExtraction(["AI output did not match the extraction schema. Enter values manually."]),
      annualized: annualize(emptyExtraction([])),
      notices: ["Structured validation failed. No inferred numbers were accepted."],
    };
  }
  return {
    method: "ai",
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    fileName: file.fileName,
    extraction: parsed.data,
    annualized: annualize(parsed.data),
    notices: parsed.data.warnings,
  };
}

export function extractRuleBased(fileName: string, textHint?: string): ExtractionResult {
  const extraction = emptyExtraction([
    "No AI key or readable document text was available. Values were not inferred. Enter utility data manually.",
  ]);
  if (textHint) {
    const kwh = textHint.match(/([\d,]+(?:\.\d+)?)\s*kwh/i);
    const therms = textHint.match(/([\d,]+(?:\.\d+)?)\s*therms?/i);
    if (kwh) extraction.electricityKwh = Number(kwh[1].replace(/,/g, ""));
    if (therms) extraction.naturalGasTherms = Number(therms[1].replace(/,/g, ""));
    if (kwh || therms) {
      extraction.confidence = 0.35;
      extraction.warnings = ["Rule-based extraction from visible text only. Review every value."];
      extraction.billingPeriodMonths = 1;
    }
  }
  return {
    method: "rule-based",
    fileName,
    extraction,
    annualized: annualize(extraction),
    notices: extraction.warnings,
  };
}

export function demoExtraction(): ExtractionResult {
  const extraction: UtilityBillExtraction = {
    utilityProvider: "National Grid (demo)",
    accountType: "Commercial (SC-3 illustrative)",
    billingPeriod: "12 months (demo composite)",
    billingPeriodMonths: 12,
    electricityKwh: 145000,
    electricityUnits: "kWh",
    peakDemandKw: 55,
    naturalGasTherms: 42000,
    gasUnits: "therms",
    electricityCost: 21750,
    gasCost: 46200,
    deliveryCharges: null,
    supplyCharges: null,
    totalBill: 67950,
    electricityRate: 0.15,
    gasRate: 1.1,
    confidence: 0.91,
    warnings: ["Demo / estimated data — not extracted from a real utility bill."],
  };
  return {
    method: "demo",
    fileName: "demo-utility-bill.pdf",
    extraction,
    annualized: annualize(extraction),
    notices: ["Demo / estimated data"],
  };
}
