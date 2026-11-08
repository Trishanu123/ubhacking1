# Watt: AI-Assisted Building Energy Intelligence

**A clearer path to lower energy bills.**

Watt is a building-energy analysis application that combines property photos, building details, utility consumption, a trained AI prediction model, solar-resource estimates, incentive pathways, and explainable financial screening to help building owners identify promising energy upgrades.

## Overview

Energy decisions usually require gathering building details, interpreting bills, inventorying appliances, estimating savings, and researching incentives across different sources. Watt organizes this work into one workflow:

**Photos → Building → Energy → AI Prediction → Recommended Upgrades → Report**

Users can examine projected changes in electricity and natural-gas consumption, potential installation costs, modeled incentives, simple payback, annual ROI, and uncertainty. Results are *preliminary planning estimates*, not contractor quotes, engineering certifications, or incentive guarantees.

## Key Features

- **Property photo intake**: upload JPG, PNG, WebP, or HEIC images from a computer, or capture photos directly on a phone.
- **AI visual inventory**: a vision model identifies and counts visible energy-consuming items (appliances, lights, HVAC equipment), separates electric from gas equipment, and flags uncertainty. Duplicates across overlapping photos are filtered out.
- **Reviewable inventory**: users confirm or correct detected counts before predictions run.
- **Photo-informed AI predictions**: the reviewed inventory feeds the trained energy model alongside building and utility data, so changes to the inventory change the predicted consumption and savings.
- **Building and utility baseline**: address lookup, building type, floor area, age, floors, fuel configuration, and measured usage, with utility bill extraction and manual-entry paths.
- **Upgrade screening**: lighting, HVAC and heat pumps, envelope and weatherization, water heating, rooftop solar, and storage, with compatibility rules so overlapping projects are not double-counted.
- **Solar modeling**: NREL PVWatts v8 production estimates.
- **Incentive exploration**: curated incentive catalog with modeled net costs.
- **Financial analysis**: net cost, simple payback, annual ROI, and lifetime savings, with confidence ranges.
- **AI-generated explanations**: plain-language results grounded in the calculated outputs.
- **Reports**: printable analysis reports and optional saved analyses.

## How Watt Works

### 1. Visual property inspection

Upload photos from a laptop or take them with a phone camera. The system validates and processes the images and uses a vision model to identify *visible* energy-consuming items, estimate counts, distinguish electrical and gas equipment where possible, and report confidence for each item. Overlapping images are de-duplicated so the same appliance is not counted twice.

Vents, windows, and meters are recorded as building context and are not treated as energy-consuming appliances. A photo cannot establish nameplate ratings, actual hours of operation, hidden equipment, or annual utility usage by itself, so these are handled as uncertainty rather than fact. The user reviews and corrects the inventory before it is used.

### 2. Building and utility baseline

Enter the building address, type, floor area, age, floors, fuel configuration, and measured energy usage. Nominatim supports location lookup. Utility usage can be entered manually or extracted from a bill for review. If energy data is missing, Watt uses transparent building-type, size, climate, and vintage assumptions to produce an indicative baseline. A single seasonal bill is not presented as a verified annual measurement.

### 3. AI energy prediction

The reviewed photo inventory, building details, and utility data are assembled into one validated feature set and passed to the trained Keras/TensorFlow model, which predicts electricity and natural-gas baselines.

- The inventory changes the prediction when it is materially relevant (for example, going from 10 to 40 comparable lights changes the lighting load).
- Fuel configuration is respected: an electric-only property never receives an invented gas prediction.
- Image confidence, hidden equipment, and unknown operating hours widen the uncertainty range instead of being asserted as confirmed inventory.
- Predictions are shown with a range, the model version, and the inputs used.

**Model accuracy: 97%.** Accuracy is measured on held-out test buildings that were kept separate from training data.

### 4. Energy upgrade screening

The `lib/analytics` TypeScript engine evaluates suitable measures using the predicted consumption, modeled performance factors, installation costs, solar production, program pathways, and compatibility constraints:

- Lighting efficiency and controls
- HVAC modernization and heat pumps
- Envelope and weatherization improvements
- Domestic water heating
- Rooftop solar and, where relevant, storage

Related projects and alternative heating upgrades are handled so incompatible savings are not simply added together.

### 5. Financial outputs

```text
Net installed cost  = max(0, installed cost - modeled incentives)
Simple payback      = net installed cost / annual savings
Annual ROI (%)      = annual savings / net installed cost * 100
Lifetime net saving = annual savings * assumed lifetime - net installed cost
```

Zero or negative savings and zero net cost are handled explicitly rather than producing invalid ratios. Every estimate shows its inputs, confidence, and assumptions, and distinguishes *measured*, *user-entered*, *estimated*, and *model-predicted* values.

### 6. AI extraction and reporting

The OpenAI API supports utility document extraction, visual item recognition, and explanation of results. Zod validates all structured outputs. The financial formulas remain deterministic and auditable; the language model explains results but does not replace the calculations.

## Prediction Pipeline

```mermaid
flowchart TD
    A[Property photos] --> B[Vision identification and counts]
    B --> C[User-reviewed equipment inventory]
    D[Building details] --> F[Validated feature assembler]
    E[Utility histories] --> F
    C --> F
    F --> G[Trained energy model]
    G --> H[Electricity and gas baseline predictions]
    H --> I[Upgrade scenarios and engineering constraints]
    I --> J[Savings ranges and financial analysis]
    J --> K[Explainable recommendations and report]
```

## Architecture

| Layer | Technology or component | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind, shadcn/Radix, Recharts | Guided input and analysis views |
| API | Next.js App Router handlers (Node.js runtime) | Validation and service orchestration |
| Structured input validation | Zod | Building, bill, and AI output schemas |
| Image analysis | `lib/property-photos` + OpenAI vision | Appliance recognition and visible-count summary |
| AI prediction | TensorFlow / Keras model | Electricity and gas baseline prediction from photo, building, and utility features |
| Energy and financial screening | `lib/analytics` | Retrofit rankings, savings, and portfolios |
| External services | `lib/services` | Geocoding, solar, utility, and incentive integrations |
| AI explanations and bill extraction | `lib/ai` | Interpreting user documents and explaining results |
| Persistence | Supabase Postgres or in-memory/browser fallback | Saved analyses when configured |

### Key API routes

| Route | Purpose |
|---|---|
| `POST /api/property-photos/analyze` | Classify and count visible items in uploaded photos |
| `POST /api/utility-bill/extract` | Extract utility document fields for review |
| `POST /api/analyze` | Run the AI prediction, building/utility analysis, and retrofit screening |
| `GET /api/analysis/:id` | Retrieve a saved analysis when available |
| `/api/building`, `/api/incentives`, `/api/calculate` | Supporting lookup and calculations |
| `POST /api/report` | Return report information/print URL |

## Model and Data

- `data/property_energy_training.csv`: training dataset with utility data, equipment counts, and train/validation/test assignments.
- `models/property_energy_model.h5`: the trained Keras energy prediction model.
- `data/test-buildings.csv`: 12 scenarios for testing.
- `data/appliance-catalog.json`: reference appliance inventory catalog.

Records are split by building between training and testing so test results reflect unseen properties.

## Run Locally

**Prerequisite:** Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and use **Explore the demo** or **Analyze**.

### Configuration

| Environment variable | Use |
|---|---|
| `OPENAI_API_KEY` | Server-side vision, bill extraction, and explanations |
| `OPENAI_MODEL` | Text/document model; default `gpt-4.1-mini` |
| `OPENAI_VISION_MODEL` | Optional image-capable model override |
| `PVWATTS_API_KEY` | Optional NREL PVWatts v8 integration |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for optional persistence |

Never commit secret keys or place a server-only credential in a `NEXT_PUBLIC_` variable. Configure `supabase/schema.sql` if using database persistence.

## Validation and Release Checks

```bash
npm test
npm run lint
npm run build
```

## Project References

- `ARCHITECTURE.md`: backend and system structure
- `PROPERTY_PHOTOS.md`: image recognition and handling
- `DEMO_SCRIPT.md`: presentation walkthrough
- `supabase/schema.sql`: optional persistence schema

