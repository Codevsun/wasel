-- Add plan_assignments to cohorts/groups (multi-plan support).
-- Run once in Supabase SQL Editor, or: supabase db query --linked -f scripts/migrate-plan-assignments.sql
--
-- Root cause: schema.sql was updated but existing DBs were created before
-- plan_assignments existed; PostgREST returns PGRST204 on read/write.

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS plan_assignments jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS plan_assignments jsonb DEFAULT '[]'::jsonb;

-- Backfill from legacy plan_id
UPDATE public.cohorts
SET plan_assignments = jsonb_build_array(
  jsonb_build_object('plan_id', plan_id, 'status', 'active')
)
WHERE plan_id IS NOT NULL
  AND (plan_assignments IS NULL OR plan_assignments = '[]'::jsonb);

UPDATE public.groups
SET plan_assignments = jsonb_build_array(
  jsonb_build_object('plan_id', plan_id, 'status', 'active')
)
WHERE plan_id IS NOT NULL
  AND (plan_assignments IS NULL OR plan_assignments = '[]'::jsonb);
