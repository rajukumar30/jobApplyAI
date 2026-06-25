-- Base table for resume metadata (originals + AI-tailored).
-- Column names are quoted camelCase to match exactly what the Express backend
-- inserts/selects (services/resumeController.js, controllers/jobController.js).
-- Idempotent: creates the table on a fresh DB, or backfills missing columns on
-- an existing single-user table. Run BEFORE 001_multi_tenant_resumes.sql.

create extension if not exists "pgcrypto";

create table if not exists public.resumes (
  id                     uuid primary key default gen_random_uuid(),
  "userId"               text,
  filename               text,
  "originalName"         text,
  "fileSize"             bigint,
  "uploadedAt"           timestamptz default now(),
  "rawText"              text,
  "parsedData"           jsonb,
  "firebaseStoragePath"  text,
  "isTailored"           boolean default false
);

-- Backfill columns if the table already existed from an older single-user build.
alter table public.resumes add column if not exists "userId"              text;
alter table public.resumes add column if not exists "isTailored"          boolean default false;
alter table public.resumes add column if not exists "firebaseStoragePath" text;

create index if not exists resumes_user_id_uploaded_at_idx
  on public.resumes ("userId", "uploadedAt" desc);

-- Backend uses the service-role key and always filters by the verified Firebase
-- UID, so RLS is enabled with no public policies (service role bypasses RLS).
alter table public.resumes enable row level security;
