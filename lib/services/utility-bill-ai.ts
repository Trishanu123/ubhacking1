import { extractRuleBased, extractWithOpenAI, demoExtraction } from "@/lib/ai/extraction";
import type { ExtractionResult } from "@/lib/types/utility";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

export interface UtilityBillAiProvider {
  extract(input: { bytes: Buffer; mime: string; fileName: string }): Promise<ExtractionResult>;
}

export class OpenAiUtilityBillProvider implements UtilityBillAiProvider {
  async extract(input: { bytes: Buffer; mime: string; fileName: string }): Promise<ExtractionResult> {
    return extractWithOpenAI(input);
  }
}

export class FallbackUtilityBillProvider implements UtilityBillAiProvider {
  async extract(input: { bytes: Buffer; mime: string; fileName: string }): Promise<ExtractionResult> {
    return extractRuleBased(input.fileName);
  }
}

export async function extractUtilityBill(file: {
  bytes: Buffer;
  mime: string;
  fileName: string;
}): Promise<ExtractionResult> {
  if (file.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      return await new OpenAiUtilityBillProvider().extract(file);
    } catch {
      const fallback = await new FallbackUtilityBillProvider().extract(file);
      fallback.notices.push("AI extraction failed. Enter values manually.");
      return fallback;
    }
  }
  return new FallbackUtilityBillProvider().extract(file);
}

export { demoExtraction };
