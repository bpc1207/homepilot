-- HomePilot production schema scaffold for Supabase Postgres.
-- Run this in the Supabase SQL editor after creating a project.
-- This schema is intentionally conservative and should be reviewed before storing real customer data.

create extension if not exists "pgcrypto";

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  address text default '',
  state text default 'Florida',
  timeline text default '30-60 days',
  property_type text default 'Single-family home',
  estimated_price numeric default 0,
  built_year text default '',
  has_hoa boolean default false,
  has_pool boolean default false,
  has_well_or_septic boolean default false,
  known_flood_history boolean default false,
  listing_path text default 'both',
  completed_task_ids text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  headline text default '',
  highlights text default '',
  upgrades text default '',
  neighborhood text default '',
  description text default '',
  social_caption text default '',
  flyer_copy text default '',
  showing_instructions text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  buyer_name text default '',
  price numeric default 0,
  concessions numeric default 0,
  buyer_agent_percent numeric default 0,
  earnest_money numeric default 0,
  financing_type text default 'Conventional',
  inspection_contingency boolean default true,
  appraisal_contingency boolean default true,
  financing_contingency boolean default true,
  closing_date date,
  rent_back text default 'None',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.showings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requester_name text default '',
  requester_email text default '',
  showing_date date,
  showing_time time,
  status text default 'Requested',
  instructions text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text default 'Other',
  storage_bucket text not null,
  storage_path text not null,
  original_name text default '',
  size_bytes bigint default 0,
  mime_type text default '',
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  stripe_session_id text,
  plan_id text not null,
  status text not null,
  amount integer not null,
  currency text default 'usd',
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  address text default '',
  state text default '',
  timeline text default '',
  property_type text default '',
  estimated_price numeric default 0,
  source text default 'website',
  created_at timestamptz default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_email text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists seller_profiles_user_id_idx on public.seller_profiles(user_id);
create index if not exists listings_user_id_idx on public.listings(user_id);
create index if not exists offers_user_id_idx on public.offers(user_id);
create index if not exists showings_user_id_idx on public.showings(user_id);
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

-- Suggested storage bucket name: homepilot-documents
-- Suggested next step: enable Supabase Auth and row-level security policies per authenticated user.
