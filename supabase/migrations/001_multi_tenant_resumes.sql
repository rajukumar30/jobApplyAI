alter table public.resumes
  add column if not exists "userId" text;

create index if not exists resumes_user_id_uploaded_at_idx
  on public.resumes ("userId", "uploadedAt" desc);

-- Assign legacy rows to the correct Firebase UID before making this required:
-- update public.resumes set "userId" = '<firebase-uid>' where "userId" is null;
-- alter table public.resumes alter column "userId" set not null;

alter table public.resumes enable row level security;

-- The Express backend uses SUPABASE_SERVICE_KEY and always filters by the
-- verified Firebase UID. Never expose the service-role key to the frontend.
