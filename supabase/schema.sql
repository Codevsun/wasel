-- =====================================================================
-- Wasel — Supabase schema (migrated from Firebase/Firestore)
-- =====================================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh
-- project. It creates all tables, the normalized progress model, indexes,
-- Row-Level Security policies, and enables Realtime.
--
-- Design notes:
--  * Every document-style table uses a TEXT primary key named `id` so the
--    Firestore compatibility layer can address rows uniformly. IDs are
--    generated with gen_random_uuid()::text when not supplied.
--  * Array / nested fields are stored as jsonb (mirrors Firestore's
--    schemaless arrays); the compat layer resolves arrayUnion/arrayRemove.
--  * `progress` is fully NORMALIZED into progress + progress_tasks +
--    progress_milestones + progress_tracks. The compat layer reconstructs
--    the original denormalized document shape on read.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Convenience default for text primary keys.
-- (Used inline as: id text primary key default gen_random_uuid()::text)

-- ----------------------------------------------------------------------
-- Core identity
-- ----------------------------------------------------------------------
create table if not exists public.users (
  id               text primary key,                  -- equals auth.users.id
  name             text,
  email            text,
  role             text,                              -- intern | trainer | management
  status           text default 'active',
  note             text default '',
  track_preference jsonb default '[]'::jsonb,
  cohort_ids       jsonb default '[]'::jsonb,
  group_ids        jsonb default '[]'::jsonb,
  notes            jsonb default '[]'::jsonb,          -- trainer notes [{id,text,created_at}]
  trainer_labels   jsonb default '[]'::jsonb,
  program_id       text,
  created_at       timestamptz default now(),
  last_active      timestamptz
);

-- ----------------------------------------------------------------------
-- Plan structure: plans > tracks > modules > milestones > tasks
-- ----------------------------------------------------------------------
create table if not exists public.plans (
  id          text primary key default gen_random_uuid()::text,
  name        text,
  is_template boolean default false,
  track_ids   jsonb default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz default now()
);

create table if not exists public.tracks (
  id        text primary key default gen_random_uuid()::text,
  plan_id   text,
  label     text,
  category  text,
  "order"   integer default 0
);

create table if not exists public.modules (
  id         text primary key default gen_random_uuid()::text,
  track_id   text,
  title      text,
  "order"    integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.milestones (
  id          text primary key default gen_random_uuid()::text,
  module_id   text,
  title       text,
  week_number integer default 1
);

create table if not exists public.tasks (
  id                 text primary key default gen_random_uuid()::text,
  milestone_id       text,
  title              text,
  type               text,
  content            text default '',
  overview           text,
  "order"            integer default 0,
  status             text,
  -- assignment metadata
  assigned_to        text,
  assigned_by        text,
  is_quick           boolean default false,
  is_assigned        boolean default false,
  is_project         boolean default false,
  due_date           text,
  template_id        text,
  estimated_duration text,
  difficulty         text,
  requirements       jsonb default '[]'::jsonb,
  deliverables       jsonb default '[]'::jsonb,
  resources          jsonb default '[]'::jsonb,
  created_at         timestamptz default now()
);

create table if not exists public.task_templates (
  id                 text primary key default gen_random_uuid()::text,
  title              text,
  type               text,
  category           text,                            -- quick_task | project
  content            text,
  overview           text,
  difficulty         text,
  estimated_duration text,
  requirements       jsonb default '[]'::jsonb,
  deliverables       jsonb default '[]'::jsonb,
  resources          jsonb default '[]'::jsonb,
  skills             jsonb default '[]'::jsonb,
  created_by         text,
  created_at         timestamptz default now()
);

-- ----------------------------------------------------------------------
-- Cohorts & groups
-- ----------------------------------------------------------------------
create table if not exists public.cohorts (
  id              text primary key default gen_random_uuid()::text,
  name            text,
  type            text,                               -- solo | group | program
  plan_id         text,
  start_date      timestamptz,
  duration_weeks  integer,
  member_uids     jsonb default '[]'::jsonb,
  group_ids       jsonb default '[]'::jsonb,
  module_schedule jsonb default '{}'::jsonb,
  created_by      text,
  created_at      timestamptz default now()
);

create table if not exists public.groups (
  id          text primary key default gen_random_uuid()::text,
  name        text,
  cohort_id   text,
  plan_id     text,
  member_uids jsonb default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz default now()
);

-- ----------------------------------------------------------------------
-- Work products
-- ----------------------------------------------------------------------
create table if not exists public.outcomes (
  id           text primary key default gen_random_uuid()::text,
  user_id      text,
  task_id      text,
  status       text default 'not_started',
  score        numeric,
  link         text,
  content      text,
  feedback     text,
  submitted_at timestamptz,
  reviewed_by  text,
  reviewed_at  timestamptz
);

create table if not exists public.submissions (
  id               text primary key default gen_random_uuid()::text,
  outcome_id       text,
  user_id          text,
  task_id          text,
  type             text,
  content          text,
  link             text,
  status           text default 'pending',
  trainer_feedback text,
  version          integer default 1,
  submitted_at     timestamptz
);

create table if not exists public.quizzes (
  id            text primary key,                     -- equals the task id
  title         text,
  description   text,
  questions     jsonb default '[]'::jsonb,
  passing_score integer default 70
);

create table if not exists public.quiz_results (
  id       text primary key default gen_random_uuid()::text,
  task_id  text,
  user_id  text,
  answers  jsonb default '{}'::jsonb,
  score    numeric,
  passed   boolean,
  attempt  integer,
  taken_at timestamptz
);

create table if not exists public.attendance (
  id             text primary key,                    -- `${date}_${uid}`
  user_id        text,
  date           text,
  status         text,
  marked_by      text,
  check_in_time  timestamptz,
  check_out_time timestamptz,
  created_at     timestamptz default now()
);

create table if not exists public.announcements (
  id         text primary key default gen_random_uuid()::text,
  title      text,
  body       text,
  target     jsonb,                                   -- { type, id } resolved target
  created_by text,
  created_at timestamptz default now()
);

create table if not exists public.discussions (
  id         text primary key default gen_random_uuid()::text,
  module_id  text,
  cohort_id  text,
  author_uid text,
  content    text,
  pinned     boolean default false,
  replies    jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.config (
  id     text primary key,                            -- e.g. 'trainer_settings'
  tracks jsonb,
  labels jsonb
);

-- ----------------------------------------------------------------------
-- Progress (NORMALIZED)
-- ----------------------------------------------------------------------
create table if not exists public.progress (
  user_id                   text primary key,
  plan_id                   text,
  cohort_id                 text,
  total_tasks               integer default 0,
  overall_pct               numeric default 0,
  trainer_closed_milestones jsonb default '[]'::jsonb,
  last_active               timestamptz
);

create table if not exists public.progress_tasks (
  user_id text not null,
  task_id text not null,
  primary key (user_id, task_id)
);

create table if not exists public.progress_milestones (
  user_id      text not null,
  milestone_id text not null,
  status       text,
  primary key (user_id, milestone_id)
);

create table if not exists public.progress_tracks (
  user_id  text not null,
  track_id text not null,
  pct      numeric default 0,
  primary key (user_id, track_id)
);

-- ----------------------------------------------------------------------
-- Indexes for common query paths
-- ----------------------------------------------------------------------
create index if not exists idx_tracks_plan        on public.tracks (plan_id);
create index if not exists idx_modules_track       on public.modules (track_id);
create index if not exists idx_milestones_module   on public.milestones (module_id);
create index if not exists idx_tasks_milestone     on public.tasks (milestone_id);
create index if not exists idx_tasks_assigned_to   on public.tasks (assigned_to);
create index if not exists idx_groups_cohort       on public.groups (cohort_id);
create index if not exists idx_outcomes_user_task  on public.outcomes (user_id, task_id);
create index if not exists idx_submissions_user_task on public.submissions (user_id, task_id);
create index if not exists idx_submissions_status  on public.submissions (status);
create index if not exists idx_quiz_results_user   on public.quiz_results (user_id, task_id);
create index if not exists idx_attendance_user     on public.attendance (user_id);
create index if not exists idx_attendance_date     on public.attendance (date);
create index if not exists idx_discussions_cohort  on public.discussions (cohort_id);
create index if not exists idx_users_role          on public.users (role);
create index if not exists idx_progress_tasks_user on public.progress_tasks (user_id);
create index if not exists idx_progress_ms_user    on public.progress_milestones (user_id);
create index if not exists idx_progress_tr_user    on public.progress_tracks (user_id);

-- ======================================================================
-- Row-Level Security
-- ======================================================================
-- These policies are intentionally permissive for authenticated users so the
-- application functions identically to the previous Firebase setup (where most
-- collections were readable/writable by signed-in users). Tighten per-role
-- later if stricter isolation is required.

do $$
declare t text;
begin
  foreach t in array array[
    'users','plans','tracks','modules','milestones','tasks','task_templates',
    'cohorts','groups','outcomes','submissions','quizzes','quiz_results',
    'attendance','announcements','discussions','config',
    'progress','progress_tasks','progress_milestones','progress_tracks'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_auth_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_auth_all', t
    );
  end loop;
end $$;

-- ======================================================================
-- Realtime
-- ======================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','plans','tracks','modules','milestones','tasks','task_templates',
    'cohorts','groups','outcomes','submissions','quizzes','quiz_results',
    'attendance','announcements','discussions','config',
    'progress','progress_tasks','progress_milestones','progress_tracks'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
