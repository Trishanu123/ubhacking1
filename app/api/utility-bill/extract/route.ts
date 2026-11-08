import { NextResponse } from "next/server";
import { extractUtilityBill } from "@/lib/services/utility-bill-ai";
import { MAX_UPLOAD_BYTES, ALLOWED_BILL_TYPES } from "@/lib/constants";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    const allowed = ALLOWED_BILL_TYPES as readonly string[];
    if (!allowed.includes(mime) && !file.name.toLowerCase().match(/\.(pdf|png|jpe?g)$/)) {
      return NextResponse.json({ error: "Supported types: PDF, JPG, PNG" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await extractUtilityBill({ bytes, mime, fileName: file.name });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: "Extraction failed. Enter utility values manually." },
      { status: 200 },
    );
  }
}
