"use client";
/* Photos remain local data URLs, so they do not use the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, FileUp, Flame, Loader2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { preparePropertyPhoto, type PropertyPhoto } from "@/lib/client/property-photos";
import { inventoryCounts, PhotoInventorySchema, type PhotoInventory } from "@/lib/property-photos/types";

export interface PropertyPhotoContext { photos: PropertyPhoto[]; inventory: PhotoInventory | null }
export const EMPTY_PHOTO_CONTEXT: PropertyPhotoContext = { photos: [], inventory: null };

export function PropertyPhotos({ value, onChange, onContinue }: {
  value: PropertyPhotoContext;
  onChange: (value: PropertyPhotoContext) => void;
  onContinue: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const counts = value.inventory ? inventoryCounts(value.inventory) : null;

  async function add(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files).slice(0, 8 - value.photos.length);
    if (!selected.length) { setError("You can add up to 8 photos. Remove one to add another."); return; }
    setBusy(true); setError(null);
    const added: PropertyPhoto[] = [];
    const errors: string[] = [];
    for (const [i, file] of selected.entries()) {
      setMessage(`Preparing photo ${i + 1} of ${selected.length}…`);
      try { added.push(await preparePropertyPhoto(file)); }
      catch (error) { errors.push(error instanceof Error ? error.message : "That photo could not be read."); }
    }
    const warning = errors.length ? errors.join(" ") : files.length > selected.length ? "Added the first available photos. You can use up to 8." : null;
    if (!added.length) {
      setError(warning); setBusy(false); setMessage("");
      return;
    }
    const photos = [...value.photos, ...added];
    onChange({ photos, inventory: null });
    await analyze(photos, warning);
  }

  async function analyze(photos: PropertyPhoto[], warning: string | null = null) {
    request.current?.abort();
    setBusy(true); setError(warning); setMessage("Looking for lights and appliances…");
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch("/api/property-photos/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: photos.map(p => p.dataUrl) }), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not read these photos.");
      if (!controller.signal.aborted) onChange({ photos, inventory: PhotoInventorySchema.parse(body.inventory) });
    } catch (error) {
      if (!controller.signal.aborted) setError([warning, error instanceof Error ? error.message : "Please try again."].filter(Boolean).join(" "));
    } finally {
      if (request.current === controller) { setBusy(false); setMessage(""); request.current = null; }
    }
  }

  function remove(id: string) {
    const photos = value.photos.filter(p => p.id !== id);
    onChange({ photos, inventory: null });
    setError(null);
    if (photos.length) void analyze(photos);
  }

  return <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Add photos of your property</h2>
      <span className="text-xs text-slate-500">Required</span>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-slate-500">Upload at least one clear photo of your property to continue.</p>
    <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-500">
      <li>Take well-lit, wide photos of your main rooms, with ceiling lights and appliances in view.</li>
      <li>Include your kitchen, heating or cooling equipment, and water heater where accessible.</li>
      <li>Add close-ups of appliance labels if readable. Keep photos sharp and avoid showing the same items repeatedly.</li>
    </ul>

    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-7 text-center"
      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void add(e.dataTransfer.files); }}>
      <FileUp className="mx-auto size-5 text-slate-400" />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" className="rounded-xl bg-white" disabled={busy || value.photos.length >= 8} onClick={() => picker.current?.click()}>Add photos</Button>
        <Button type="button" variant="ghost" className="rounded-xl text-slate-600" disabled={busy || value.photos.length >= 8} onClick={() => camera.current?.click()}><Camera className="size-4" />Take a photo</Button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Or drop images here · up to 8 photos · 10 MB each</p>
      <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP or HEIC</p>
      <input ref={picker} type="file" className="sr-only" aria-label="Add property photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple disabled={busy} onChange={e => { void add(e.target.files); e.target.value = ""; }} />
      <input ref={camera} type="file" className="sr-only" aria-label="Take a property photo" accept="image/*" capture="environment" disabled={busy} onChange={e => { void add(e.target.files); e.target.value = ""; }} />
    </div>

    {!!value.photos.length && <div className="mt-4 flex flex-wrap gap-2">{value.photos.map((p, i) => <div key={p.id} className="relative size-20 overflow-hidden rounded-xl border border-slate-200">
      <img src={p.dataUrl} alt={`Property photo ${i + 1}`} className="size-full object-cover" />
      <button type="button" disabled={busy} aria-label={`Remove photo ${i + 1}`} onClick={() => remove(p.id)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm disabled:opacity-50"><X className="size-3.5" /></button>
    </div>)}</div>}

    {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    {error && !busy && !!value.photos.length && !value.inventory && <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={() => void analyze(value.photos)}>Retry analysis</Button>}

    {value.inventory && counts && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <p className="text-sm font-medium text-slate-800">Visible in your photos</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div><p className="flex items-center gap-1.5 text-xs text-slate-500"><Zap className="size-3.5" />Electric items</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{counts.electric}</p></div>
        <div><p className="flex items-center gap-1.5 text-xs text-slate-500"><Flame className="size-3.5" />Gas items</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{counts.gas}</p></div>
      </div>
      {!!value.inventory.items.length && <ul className="mt-4 divide-y divide-slate-200/70">{value.inventory.items.map((item, i) => <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{item.label}<span className="ml-2 text-xs text-slate-400">{item.energySource === "unclear" ? "Fuel unclear" : item.energySource === "both" ? "Electric + gas" : item.energySource === "gas" ? "Gas" : "Electric"}{item.confidence < 0.7 ? " · uncertain" : ""}</span></span><span className="font-medium tabular-nums text-slate-700">{item.count}</span></li>)}</ul>}
      {!value.inventory.items.length && <p className="mt-3 text-sm text-slate-500">No lights or appliances could be identified. Try clearer room photos, or continue.</p>}
      {!!counts.unclear && <p className="mt-3 text-xs text-slate-500">Fuel is unclear for {counts.unclear} item{counts.unclear === 1 ? "" : "s"}; these aren’t included in the fuel counts.</p>}
      {value.inventory.note && <p className="mt-3 text-xs leading-relaxed text-slate-500">{value.inventory.note}</p>}
      <p className="mt-3 text-xs text-slate-400">Visual estimates only. Items using both fuels appear in both counts.</p>
    </div>}

    <div className="mt-8 flex items-center justify-end border-t border-slate-100 pt-6">
      <Button type="button" className="rounded-xl px-5" disabled={busy || value.photos.length === 0} onClick={() => { if (!busy && value.photos.length > 0) onContinue(); }}>Continue<ArrowRight className="size-4" /></Button>
    </div>
  </section>;
}
