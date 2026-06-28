-- Fix announcements.target: jsonb → text
-- Run once in Supabase SQL Editor if intern announcements are empty.
--
-- Root cause: target was jsonb but the app filters with plain strings,
-- which Postgres rejects ("invalid input syntax for type json").

ALTER TABLE public.announcements
  ALTER COLUMN target TYPE text
  USING (
    CASE
      WHEN target IS NULL THEN NULL
      WHEN jsonb_typeof(target) = 'string' THEN target #>> '{}'
      WHEN jsonb_typeof(target) = 'object' THEN COALESCE(target->>'id', target->>'type')
      ELSE target::text
    END
  );

CREATE INDEX IF NOT EXISTS idx_announcements_target_created
  ON public.announcements (target, created_at DESC);
