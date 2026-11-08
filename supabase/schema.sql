-- Watt schema. Run in the Supabase SQL editor.
-- Persistence is optional: without these tables the app still stores analyses in memory + the browser session.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  latitude double precision,
  longitude double precision,
  building_type text,
  square_feet numeric,
  year_built integer,
  stories integer,
  parcel_id text,
  created_at timestamptz not null default now()
);

create table if not exists analyses (
  id uuid primary key,
  building_id uuid references buildings(id) on delete set null,
  status text not null default 'complete',
  annual_electricity_kwh numeric,
  annual_gas_therms numeric,
  annual_energy_cost numeric,
  estimated_eui numeric,
  confidence text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists utility_documents (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id) on delete cascade,
  file_path text,
  file_name text,
  extraction_status text,
  extracted_data jsonb,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id) on delete cascade,
  category text,
  name text,
  estimated_cost numeric,
  annual_savings numeric,
  energy_savings numeric,
  incentives numeric,
  net_cost numeric,
  payback_years numeric,
  roi_percent numeric,
  confidence text,
  assumptions jsonb,
  next_step text,
  created_at timestamptz not null default now()
);

create table if not exists incentives (
  id text primary key,
  name text not null,
  provider text,
  technology text[],
  eligibility text,
  incentive_type text,
  incentive_value text,
  source_url text,
  source_name text,
  verification_date date,
  metadata jsonb
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id) on delete cascade,
  name text,
  url text,
  category text,
  retrieved_at timestamptz
);

-- Optional RAG seam. Unused in the MVP pipeline; structured incentive records are queried first.
create table if not exists incentive_embeddings (
  id text primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb
);
