// Normalized progress store.
//
// The original Firestore model kept one denormalized `progress/{uid}` document
// holding `completed_tasks[]`, `milestone_status{}` and `track_pct{}`. In
// Supabase that data is fully normalized across relational tables:
//
//   progress              (one summary row per intern)
//   progress_tasks        (one row per completed task)
//   progress_milestones   (one row per milestone status)
//   progress_tracks       (one row per track percentage)
//
// This module reads those tables back into the denormalized shape the UI
// expects, and writes a full composed progress object back into the tables.

import { supabase } from "./client"

function composeFromRows(base, tasks, milestones, tracks) {
  if (!base) return null
  return {
    id: base.user_id,
    user_id: base.user_id,
    plan_id: base.plan_id ?? null,
    cohort_id: base.cohort_id ?? null,
    total_tasks: base.total_tasks ?? 0,
    overall_pct: base.overall_pct ?? 0,
    last_active: base.last_active ?? null,
    trainer_closed_milestones: base.trainer_closed_milestones ?? [],
    completed_tasks: (tasks ?? []).map((t) => t.task_id),
    milestone_status: Object.fromEntries(
      (milestones ?? []).map((m) => [m.milestone_id, m.status])
    ),
    track_pct: Object.fromEntries((tracks ?? []).map((t) => [t.track_id, t.pct])),
  }
}

/** Reconstruct one intern's denormalized progress document, or null. */
export async function composeProgress(uid) {
  const { data: base } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle()
  if (!base) return null

  const [{ data: tasks }, { data: milestones }, { data: tracks }] = await Promise.all([
    supabase.from("progress_tasks").select("task_id").eq("user_id", uid),
    supabase.from("progress_milestones").select("milestone_id, status").eq("user_id", uid),
    supabase.from("progress_tracks").select("track_id, pct").eq("user_id", uid),
  ])
  return composeFromRows(base, tasks, milestones, tracks)
}

/** Reconstruct every intern's progress document (used for collection reads). */
export async function composeAllProgress() {
  const [{ data: bases }, { data: tasks }, { data: milestones }, { data: tracks }] =
    await Promise.all([
      supabase.from("progress").select("*"),
      supabase.from("progress_tasks").select("user_id, task_id"),
      supabase.from("progress_milestones").select("user_id, milestone_id, status"),
      supabase.from("progress_tracks").select("user_id, track_id, pct"),
    ])

  const byUser = (rows) => {
    const map = {}
    for (const r of rows ?? []) (map[r.user_id] ||= []).push(r)
    return map
  }
  const taskMap = byUser(tasks)
  const msMap = byUser(milestones)
  const trMap = byUser(tracks)

  return (bases ?? []).map((base) =>
    composeFromRows(base, taskMap[base.user_id], msMap[base.user_id], trMap[base.user_id])
  )
}

/**
 * Persist a full composed progress object into the normalized tables.
 * `composed` matches the denormalized Firestore shape.
 */
export async function saveProgress(uid, composed) {
  const lastActive =
    composed.last_active && composed.last_active._isTimestamp
      ? composed.last_active.toDate().toISOString()
      : composed.last_active instanceof Date
        ? composed.last_active.toISOString()
        : composed.last_active ?? new Date().toISOString()

  const { error: baseErr } = await supabase.from("progress").upsert({
    user_id: uid,
    plan_id: composed.plan_id ?? null,
    cohort_id: composed.cohort_id ?? null,
    total_tasks: composed.total_tasks ?? 0,
    overall_pct: composed.overall_pct ?? 0,
    trainer_closed_milestones: composed.trainer_closed_milestones ?? [],
    last_active: lastActive,
  })
  if (baseErr) throw baseErr

  // Replace child rows wholesale — simplest correct strategy at this scale.
  await Promise.all([
    supabase.from("progress_tasks").delete().eq("user_id", uid),
    supabase.from("progress_milestones").delete().eq("user_id", uid),
    supabase.from("progress_tracks").delete().eq("user_id", uid),
  ])

  const taskRows = (composed.completed_tasks ?? []).map((task_id) => ({
    user_id: uid,
    task_id,
  }))
  const msRows = Object.entries(composed.milestone_status ?? {}).map(
    ([milestone_id, status]) => ({ user_id: uid, milestone_id, status })
  )
  const trRows = Object.entries(composed.track_pct ?? {}).map(([track_id, pct]) => ({
    user_id: uid,
    track_id,
    pct,
  }))

  const inserts = []
  if (taskRows.length) inserts.push(supabase.from("progress_tasks").insert(taskRows))
  if (msRows.length) inserts.push(supabase.from("progress_milestones").insert(msRows))
  if (trRows.length) inserts.push(supabase.from("progress_tracks").insert(trRows))
  const results = await Promise.all(inserts)
  for (const r of results) if (r.error) throw r.error
}
