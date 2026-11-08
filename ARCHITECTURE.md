# Architecture

```
                    ┌───────────────────┐
                    │   Next.js UI      │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Next.js API       │
                    │ Route Handlers    │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼────────────────────┐
          ▼                   ▼                    ▼
   Building Data         Utility AI          Incentives
       Service            Service              Service
          │                   │                    │
          └───────────────────┼────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │ Analysis Engine   │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
          Solar             HVAC            Lighting
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                    ┌───────────────────┐
                    │ Financial Engine  │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ Recommendations   │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ Results Dashboard │
                    └───────────────────┘
```

## Design rules

- LLMs extract, classify, and explain. They never compute payback, ROI, or net cost.
- Every external provider has a real implementation and a labeled fallback.
- Analyses persist to Supabase when configured; otherwise they live in process memory and `sessionStorage`.
- Incentive records cite official sources. Dollar incentives in the financial model are labeled planning assumptions.

## Key modules

| Path | Role |
| --- | --- |
| `lib/analytics/pipeline.ts` | Orchestrates the analysis |
| `lib/analytics/financial.ts` | Deterministic money math |
| `lib/analytics/recommendations.ts` | Screening + priority (not ROI-only) |
| `lib/services/*` | GIS, PVWatts, incentives, bills, rates |
| `lib/ai/*` | Extraction, explanation, embedding seam |
| `lib/db/store.ts` | Memory + optional Supabase |
| `app/api/analyze/route.ts` | Main POST endpoint |
