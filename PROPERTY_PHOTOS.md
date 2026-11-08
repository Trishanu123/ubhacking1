# Property photo context in Analyze

The standalone `/scan` dashboard and scan APIs have been removed. The Analyze wizard now starts with a required Photos step, using the existing slate/white styling and components. Users must upload at least one photo before continuing; they can upload up to eight images or take a photo with their mobile camera. The step includes guidance for room views, equipment and readable labels. The result is a short item list and visible electric/gas counts, including lights. No bills, consumption, calibration, recommendations, report exports, database records, or prediction changes are attached to photo analysis.

Run `npm install` and `npm run dev`, then open `/analyze`. For photo recognition, set the existing server-only `OPENAI_API_KEY`; `OPENAI_VISION_MODEL` overrides `OPENAI_MODEL` (default `gpt-4.1-mini`). The model must support image input and structured outputs. No Supabase connection or migration is needed. Photo upload is required for the custom flow; GPT recognition starts automatically after each upload batch finishes, and updates when photos are removed. A retry action is available if recognition fails. Missing keys or failed recognition do not discard uploaded photos. Demo mode continues to launch the existing demo directly.

`POST /api/property-photos/analyze` accepts `{ images: [JPEG data URLs] }` and returns `{ inventory: { items: [{ label, count, energySource, confidence }], note } }`. The server validates input, caps the total body at 2.9 MB, verifies image bytes, resizes and strips metadata, then calls GPT with a structured JSON schema. Per-instance abuse limits allow 10 requests/client/hour; multi-instance deployments should add a shared platform rate limit. The hosting proxy must overwrite `x-forwarded-for`.

Original JPG/PNG/WebP/HEIC inputs are limited to 10 MB each, compressed in the browser, and stripped of EXIF/GPS on both client and server. The app saves neither images nor inventories. They stay in the current Analyze component's memory and are released when the user leaves/reloads. API response storage is disabled; provider retention policies still apply. Camera behavior depends on device/browser support and gallery upload remains available.

All photos are analyzed together to reduce overlapping-view duplicates. Counts are visual estimates, not a complete property inventory. Fuel can be unclear; those items are excluded from electric/gas counts. Both-fuel appliances appear in both counts. Vents, windows and meters are not counted as consuming appliances. No photo result is passed to `/api/analyze`, and the former scan lighting hooks were removed from the savings engine.

Main files:

- `app/analyze/page.tsx`: required Photos step and existing wizard navigation.
- `components/analysis/property-photos.tsx`: minimal upload/camera, preview, item list and counts.
- `components/site-chrome.tsx`: removes the Scan link.
- `app/api/property-photos/analyze/route.ts`: stateless validated photo endpoint.
- `lib/property-photos/analyze.ts`: GPT recognition, with no consumption/savings prompt.
- `lib/property-photos/types.ts`: item validation and fuel count totals.
- `lib/property-photos/photos.test.ts`: counting, prediction isolation, metadata stripping, endpoint validation.
- `lib/client/property-photos.ts`: compression, metadata removal and lazy HEIC conversion (renamed from the former scan helper).
- `lib/analytics/measure.ts`, `lib/analytics/lighting.ts`: removes unused scan overrides; existing vintage/area savings formulas remain.
- `.env.example`, `README.md`: updated setup; obsolete scan persistence flags removed.
- `supabase/schema.sql`: removes the unused scan-table scaffold. No remote database was altered.

Removed: `app/scan`, `app/api/scan`, `components/scan`, `lib/scan`, `lib/client/scan-request.ts`, the unapplied scan migration, and the old Property Scan guide. Existing appliance-catalog/test-building data and unrelated working-tree changes were preserved.

Verification: all 21 tests and the production build pass. Browser testing verified upload, GPT response rendering, electric/gas counts, continuing to Building, reviewing/removing photos, and continuing after photo upload. The Continue button is disabled without photos or while processing, and custom-flow navigation guards prevent bypassing the photo step. A live negative test using the repository's synthetic utility-bill image correctly returned no appliances. `/scan` returns 404. Lint reports two existing warnings outside the photo feature. Representative property-photo accuracy and physical phone-camera behavior still need device testing.
