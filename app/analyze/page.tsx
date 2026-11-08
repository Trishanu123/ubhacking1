"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BUILDING_TYPE_LABELS, BUILDING_TYPES, type BuildingType } from "@/lib/types/building";
import type { Analysis } from "@/lib/types/analysis";
import type { ExtractionResult } from "@/lib/types/utility";
import { usd, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cacheAnalysis } from "@/lib/client/analysis-cache";
import { PropertyPhotos, EMPTY_PHOTO_CONTEXT, type PropertyPhotoContext } from "@/components/analysis/property-photos";
import { inventoryCounts } from "@/lib/property-photos/types";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import {
  type AnalyzeFormState,
  DEMO_FORM,
  EMPTY_FORM,
  clearForm,
  loadForm,
  saveForm,
  toAnalyzeRequest,
  validateBuilding,
  validateEnergy,
} from "@/lib/client/analyze-form";

const STEPS = ["Photos", "Building", "Energy", "Analysis", "Results"] as const;
const SURFACE = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const MICRO = "text-xs font-medium tracking-wider text-slate-500 uppercase";

const PLACEHOLDER_PIPELINE = [
  "Locating building",
  "Assembling utility data",
  "Calculating energy baseline",
  "Modeling solar resource",
  "Evaluating retrofit measures",
  "Matching incentive programs",
  "Running financial model",
  "Writing explanation",
];

type Errors = Partial<Record<keyof AnalyzeFormState, string>>;

function initialState(demo: boolean, fresh: boolean) {
  if (demo) return { form: DEMO_FORM, extraction: null };
  if (fresh) {
    clearForm();
    return { form: EMPTY_FORM, extraction: null };
  }
  return loadForm() ?? { form: EMPTY_FORM, extraction: null };
}

function AnalyzeInner() {
  const router = useRouter();
  const search = useSearchParams();
  const startDemo = search.get("demo") === "1";

  const [init] = useState(() => initialState(startDemo, search.get("new") === "1"));
  const [form, setForm] = useState<AnalyzeFormState>(init.form);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(init.extraction);
  const [step, setStep] = useState(() =>
    startDemo ? 3 : 0,
  );
  const [photoContext, setPhotoContext] = useState<PropertyPhotoContext>(EMPTY_PHOTO_CONTEXT);
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(startDemo);
  const [pipeline, setPipeline] = useState<Analysis["pipeline"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editExtracted, setEditExtracted] = useState(false);
  const [isDemoRun, setIsDemoRun] = useState(startDemo);

  useEffect(() => {
    if (!isDemoRun) saveForm(form, extraction);
  }, [form, extraction, isDemoRun]);

  const set = <K extends keyof AnalyzeFormState>(key: K, value: AnalyzeFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  async function onUpload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is larger than 8 MB. Upload a smaller PDF or image, or enter values manually.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/utility-bill/extract", { method: "POST", body });
      const json = await res.json();
      if (json.result) {
        const result = json.result as ExtractionResult;
        const a = result.annualized;
        setExtraction(result);
        setEditExtracted(false);
        setForm((f) => ({
          ...f,
          electricityKwh: a.electricityKwh ? String(Math.round(a.electricityKwh)) : f.electricityKwh,
          gasTherms: a.naturalGasTherms ? String(Math.round(a.naturalGasTherms)) : f.gasTherms,
          elecRate: a.electricityRate ? String(a.electricityRate) : f.elecRate,
          gasRate: a.gasRate ? String(a.gasRate) : f.gasRate,
          hasGasService: a.naturalGasTherms ? true : f.hasGasService,
        }));
      } else {
        setError(json.error ?? "Could not read that bill. Enter values manually.");
      }
    } catch {
      setError("Upload failed. Enter values manually.");
    } finally {
      setUploading(false);
    }
  }

  function goToEnergy() {
    if (photoContext.photos.length === 0) {
      setError("Add at least one property photo before continuing.");
      setStep(0);
      return;
    }
    const e = validateBuilding(form);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setError(null);
      setStep(2);
    }
  }

  const run = useCallback(
    async (mode: "demo" | "custom", payloadForm: AnalyzeFormState, payloadExtraction: ExtractionResult | null) => {
      if (mode === "custom") {
        if (photoContext.photos.length === 0) {
          setError("Add at least one property photo before continuing.");
          setStep(0);
          return;
        }
        const b = validateBuilding(payloadForm);
        const e = validateEnergy(payloadForm);
        if (Object.keys(b).length || Object.keys(e).length) {
          setErrors({ ...b, ...e });
          setStep(Object.keys(b).length ? 1 : 2);
          return;
        }
      }
      setRunning(true);
      setError(null);
      setPipeline([]);
      setStep(3);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toAnalyzeRequest(mode, payloadForm, payloadExtraction)),
        });
        const json = await res.json();
        if (!res.ok || !json.analysis) {
          setError(json.error ?? "Analysis failed. Check your inputs and try again.");
          setRunning(false);
          setStep(mode === "demo" ? 1 : 2);
          return;
        }
        const analysis = json.analysis as Analysis;
        cacheAnalysis(analysis);
        setPipeline(analysis.pipeline);
        await new Promise((r) => setTimeout(r, 1400));
        setStep(4);
        await new Promise((r) => setTimeout(r, 500));
        router.push(`/analysis/${analysis.id}`);
      } catch {
        setError("Network error. Your inputs are saved — try again.");
        setRunning(false);
        setStep(mode === "demo" ? 1 : 2);
      }
    },
    [router, photoContext.photos.length],
  );

  function runDemo() {
    setIsDemoRun(true);
    setForm(DEMO_FORM);
    setExtraction(null);
    void run("demo", DEMO_FORM, null);
  }

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!startDemo || autoStarted.current) return;
    autoStarted.current = true;
    void run("demo", DEMO_FORM, null);
  }, [run, startDemo]);

  const a = extraction?.annualized;
  const photoCounts = photoContext.inventory ? inventoryCounts(photoContext.inventory) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <p className={MICRO}>Preliminary analysis</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Analyze a building</h1>
      <p className="mt-2 text-sm text-slate-500">
        Add property photos and an address to get started. Other details are estimated from the building type and size if left blank.
      </p>

      <Stepper step={step} onSelect={(i) => !running && i < step && (i === 0 || photoContext.photos.length > 0) && setStep(i)} />

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 1 && photoCounts && (
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Photo context · {photoCounts.electric} electric items · {photoCounts.gas} gas items</span>
          <button type="button" className="underline underline-offset-2" onClick={() => setStep(0)}>Review photos</button>
        </div>
      )}
      <div key={step} className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 0 && <PropertyPhotos value={photoContext} onChange={setPhotoContext} onContinue={() => { if (photoContext.photos.length > 0) { setError(null); setStep(1); } }} />}
        {step === 1 && (
          <section className={cn(SURFACE, "p-6 sm:p-8")}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Building</h2>
            <p className="mt-1 text-sm text-slate-500">Public records fill gaps when available; lookups never block the analysis.</p>
            <div className="mt-6 grid gap-5">
              <Field id="address" label="Address" error={errors.address}>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="123 Example Street, Buffalo, NY"
                  aria-invalid={!!errors.address}
                  autoComplete="street-address"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="type" label="Building type">
                  <Select value={form.buildingType} onValueChange={(v) => set("buildingType", v as BuildingType)}>
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDING_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {BUILDING_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="sqft" label="Square footage" optional error={errors.squareFeet}>
                  <Input id="sqft" inputMode="numeric" value={form.squareFeet} onChange={(e) => set("squareFeet", e.target.value)} placeholder="25,000" aria-invalid={!!errors.squareFeet} />
                </Field>
                <Field id="year" label="Year built" optional error={errors.yearBuilt}>
                  <Input id="year" inputMode="numeric" value={form.yearBuilt} onChange={(e) => set("yearBuilt", e.target.value)} placeholder="1988" aria-invalid={!!errors.yearBuilt} />
                </Field>
                <Field id="floors" label="Floors" optional error={errors.stories}>
                  <Input id="floors" inputMode="numeric" value={form.stories} onChange={(e) => set("stories", e.target.value)} placeholder="3" aria-invalid={!!errors.stories} />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" className="rounded-xl text-slate-600" onClick={() => setStep(0)}><ArrowLeft className="size-4" /> Photos</Button>
                <Button variant="ghost" className="rounded-xl text-slate-600" onClick={runDemo}>
                  <Sparkles className="size-4" /> Try the demo building
                </Button>
              </div>
              <Button className="rounded-xl px-5" onClick={goToEnergy}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={cn(SURFACE, "p-6 sm:p-8")}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Energy</h2>
            <p className="mt-1 text-sm text-slate-500">Upload a bill, or type annual totals. A single month is annualized automatically.</p>

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700">Fuel service</p>
              <div role="radiogroup" className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { v: true, l: "Electric + gas" },
                  { v: false, l: "Electric only" },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    role="radio"
                    aria-checked={form.hasGasService === o.v}
                    onClick={() => set("hasGasService", o.v)}
                    className={cn(
                      "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
                      form.hasGasService === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <label
              htmlFor="bill"
              className={cn(
                "mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-8 text-center transition-colors hover:border-slate-400 hover:bg-slate-50",
                uploading && "pointer-events-none opacity-70",
              )}
            >
              {uploading ? <Loader2 className="size-5 animate-spin text-slate-500" /> : <FileUp className="size-5 text-slate-400" />}
              <span className="mt-2 text-sm font-medium text-slate-700">
                {uploading ? "Reading your bill…" : extraction ? `Replace ${extraction.fileName}` : "Upload a utility bill"}
              </span>
              <span className="mt-1 text-xs text-slate-500">PDF, JPG or PNG · up to 8 MB</span>
              <input
                id="bill"
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>

            {uploading && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            )}

            {extraction && a && !uploading && (
              <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                    <Check className="size-4" /> Utility data detected
                  </p>
                  <span className="text-xs text-emerald-700">
                    {extraction.method === "ai" ? "AI extraction" : "Rule-based extraction"} ·{" "}
                    {Math.round(extraction.extraction.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Detected label="Electricity" value={a.electricityKwh != null ? `${num(a.electricityKwh)} kWh/yr` : "—"} />
                  <Detected label="Gas" value={a.naturalGasTherms != null ? `${num(a.naturalGasTherms)} therms/yr` : "—"} />
                  <Detected label="Annual cost" value={a.totalAnnualCost != null ? usd(a.totalAnnualCost) : "—"} />
                </div>
                {extraction.notices.length > 0 && <p className="mt-3 text-xs text-slate-500">{extraction.notices.join(" ")}</p>}
                {!editExtracted && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg bg-white" onClick={() => setEditExtracted(true)}>
                    Edit values
                  </Button>
                )}
              </div>
            )}

            {(editExtracted || !extraction) && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field id="kwh" label="Annual electricity" unit="kWh/yr" optional error={errors.electricityKwh}>
                  <Input id="kwh" inputMode="decimal" value={form.electricityKwh} onChange={(e) => set("electricityKwh", e.target.value)} placeholder="Estimated if blank" aria-invalid={!!errors.electricityKwh} />
                </Field>
                <Field id="erate" label="Electricity rate" unit="$/kWh" optional error={errors.elecRate}>
                  <Input id="erate" inputMode="decimal" value={form.elecRate} onChange={(e) => set("elecRate", e.target.value)} placeholder="State average if blank" aria-invalid={!!errors.elecRate} />
                </Field>
                {form.hasGasService && (
                  <>
                    <Field id="therms" label="Annual gas" unit="therms/yr" optional error={errors.gasTherms}>
                      <Input id="therms" inputMode="decimal" value={form.gasTherms} onChange={(e) => set("gasTherms", e.target.value)} placeholder="Estimated if blank" aria-invalid={!!errors.gasTherms} />
                    </Field>
                    <Field id="grate" label="Gas rate" unit="$/therm" optional error={errors.gasRate}>
                      <Input id="grate" inputMode="decimal" value={form.gasRate} onChange={(e) => set("gasRate", e.target.value)} placeholder="State average if blank" aria-invalid={!!errors.gasRate} />
                    </Field>
                  </>
                )}
              </div>
            )}
            {!form.hasGasService && (
              <p className="mt-4 text-xs text-slate-500">Electric-only: gas use is set to zero and gas-heating measures are skipped.</p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <Button variant="ghost" className="rounded-xl text-slate-600" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button className="rounded-xl px-5" onClick={() => run("custom", form, extraction)} disabled={running || uploading}>
                Run analysis <ArrowRight className="size-4" />
              </Button>
            </div>
          </section>
        )}

        {step >= 3 && (
          <section className={cn(SURFACE, "p-6 sm:p-8")} aria-live="polite">
            <div className="flex items-center gap-3">
              {step === 4 ? (
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-4" />
                </span>
              ) : (
                <Loader2 className="size-5 animate-spin text-slate-400" />
              )}
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  {step === 4 ? "Opening your retrofit plan" : pipeline.length ? "Analysis complete" : "Running analysis"}
                </h2>
                <p className="text-sm text-slate-500">
                  {pipeline.length ? "Each line below is a real step returned by the engine." : "This usually takes 5–20 seconds."}
                </p>
              </div>
            </div>
            <ul className="mt-6 divide-y divide-slate-100">
              {pipeline.length
                ? pipeline.map((s, i) => (
                    <li
                      key={s.key}
                      className="flex items-start gap-3 py-3 animate-in fade-in slide-in-from-left-1 fill-mode-both duration-300"
                      style={{ animationDelay: `${i * 120}ms` }}
                    >
                      <StatusDot status={s.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{s.label}</p>
                        <p className="truncate text-xs text-slate-500">{s.detail}</p>
                      </div>
                    </li>
                  ))
                : PLACEHOLDER_PIPELINE.map((label) => (
                    <li key={label} className="flex items-center gap-3 py-3">
                      <Skeleton className="size-5 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm text-slate-400">{label}</p>
                        <Skeleton className="mt-1.5 h-2.5 w-2/3" />
                      </div>
                    </li>
                  ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Stepper({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  return (
    <ol className="mt-8 flex items-center">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={!done}
              className={cn("flex items-center gap-2 rounded-lg text-sm transition-colors", done && "cursor-pointer hover:text-slate-900")}
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                  done && "bg-slate-900 text-white",
                  current && "bg-white text-slate-900 ring-2 ring-slate-900",
                  !done && !current && "bg-slate-100 text-slate-400",
                )}
              >
                {done ? <Check className="size-3.5" /> : String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn("hidden font-medium sm:inline", current ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400")}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="mx-3 h-px flex-1 bg-slate-200">
                <span className={cn("block h-px bg-slate-900 transition-all duration-500", done ? "w-full" : "w-0")} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  id,
  label,
  unit,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  unit?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-baseline gap-1.5 text-slate-700">
        {label}
        {unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
        {optional && <span className="ml-auto text-xs font-normal text-slate-400">Optional</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Detected({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: Analysis["pipeline"][number]["status"] }) {
  const style =
    status === "done"
      ? "bg-emerald-100 text-emerald-700"
      : status === "error"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", style)}>
      {status === "done" ? <Check className="size-3" /> : status === "error" ? "!" : "~"}
    </span>
  );
}

const noopSubscribe = () => () => {};

function IntakeSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14" aria-busy="true">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-8 h-7 w-full" />
      <Skeleton className="mt-6 h-80 w-full rounded-2xl" />
    </main>
  );
}

/** Saved intake state lives in sessionStorage, so the wizard renders client-side only. */
function ClientOnlyIntake() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return isClient ? <AnalyzeInner /> : <IntakeSkeleton />;
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<IntakeSkeleton />}>
      <ClientOnlyIntake />
    </Suspense>
  );
}
