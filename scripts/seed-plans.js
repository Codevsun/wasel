// Seed plan templates (Frontend, Git, AI) into Supabase.
//
// Usage:
//   npm run seed:plans
//   npm run seed:plans -- --force    # delete existing templates and re-seed
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

/* global process */
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { PLAN_TEMPLATES, LEGACY_PLAN_NAMES } from "./data/internship-plan.js"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FORCE = process.argv.includes("--force")

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** @typedef {{ title: string; type: string; content: string; quiz?: { passing_score: number; questions: unknown[] } }} TaskDef */
/** @typedef {{ title: string; week_number: number; tasks: TaskDef[] }} WeekDef */
/** @typedef {{ title: string; order: number; weeks: WeekDef[] }} ModuleDef */
/** @typedef {{ label: string; category: string; order: number; modules: ModuleDef[] }} TrackDef */
/** @typedef {{ name: string; tracks: TrackDef[] }} PlanDefinition */

const ALL_PLAN_NAMES = [...PLAN_TEMPLATES.map((p) => p.name), ...LEGACY_PLAN_NAMES]

async function findPlanByName(name) {
  const { data, error } = await admin.from("plans").select("id, name").eq("name", name).maybeSingle()
  if (error) throw error
  return data
}

async function deletePlanTree(planId) {
  const { data: tracks, error: tErr } = await admin.from("tracks").select("id").eq("plan_id", planId)
  if (tErr) throw tErr

  const trackIds = (tracks ?? []).map((t) => t.id)
  if (!trackIds.length) {
    await admin.from("plans").delete().eq("id", planId)
    return
  }

  const { data: modules, error: mErr } = await admin
    .from("modules")
    .select("id")
    .in("track_id", trackIds)
  if (mErr) throw mErr

  const moduleIds = (modules ?? []).map((m) => m.id)
  let milestoneIds = []
  if (moduleIds.length) {
    const { data: milestones, error: msErr } = await admin
      .from("milestones")
      .select("id")
      .in("module_id", moduleIds)
    if (msErr) throw msErr
    milestoneIds = (milestones ?? []).map((ms) => ms.id)
  }

  let taskIds = []
  if (milestoneIds.length) {
    const { data: tasks, error: taskErr } = await admin
      .from("tasks")
      .select("id")
      .in("milestone_id", milestoneIds)
    if (taskErr) throw taskErr
    taskIds = (tasks ?? []).map((t) => t.id)
  }

  if (taskIds.length) {
    await admin.from("quizzes").delete().in("id", taskIds)
    await admin.from("tasks").delete().in("id", taskIds)
  }
  if (milestoneIds.length) await admin.from("milestones").delete().in("id", milestoneIds)
  if (moduleIds.length) await admin.from("modules").delete().in("id", moduleIds)
  if (trackIds.length) await admin.from("tracks").delete().in("id", trackIds)
  await admin.from("plans").delete().eq("id", planId)
}

async function insertPlan(/** @type {PlanDefinition} */ planDef) {
  const stats = { tracks: 0, modules: 0, milestones: 0, tasks: 0, quizzes: 0 }
  const now = new Date().toISOString()

  const planId = randomUUID()
  const { error: planErr } = await admin.from("plans").insert({
    id: planId,
    name: planDef.name,
    is_template: true,
    track_ids: [],
    created_at: now,
  })
  if (planErr) throw planErr

  const trackIds = []

  for (const trackDef of planDef.tracks) {
    const trackId = randomUUID()
    trackIds.push(trackId)
    stats.tracks++

    const { error: trackErr } = await admin.from("tracks").insert({
      id: trackId,
      plan_id: planId,
      label: trackDef.label,
      category: trackDef.category,
      order: trackDef.order,
    })
    if (trackErr) throw trackErr

    for (const modDef of trackDef.modules) {
      const moduleId = randomUUID()
      stats.modules++

      const { error: modErr } = await admin.from("modules").insert({
        id: moduleId,
        track_id: trackId,
        title: modDef.title,
        order: modDef.order,
        created_at: now,
      })
      if (modErr) throw modErr

      for (const week of modDef.weeks) {
        const milestoneId = randomUUID()
        stats.milestones++

        const { error: msErr } = await admin.from("milestones").insert({
          id: milestoneId,
          module_id: moduleId,
          title: week.title,
          week_number: week.week_number,
        })
        if (msErr) throw msErr

        for (let i = 0; i < week.tasks.length; i++) {
          const taskDef = week.tasks[i]
          const taskId = randomUUID()
          stats.tasks++

          const { error: taskErr } = await admin.from("tasks").insert({
            id: taskId,
            milestone_id: milestoneId,
            title: taskDef.title,
            type: taskDef.type,
            content: taskDef.content ?? "",
            order: i,
            created_at: now,
          })
          if (taskErr) throw taskErr

          if (taskDef.type === "quiz" && taskDef.quiz) {
            stats.quizzes++
            const { error: quizErr } = await admin.from("quizzes").insert({
              id: taskId,
              title: taskDef.title,
              description: taskDef.content ?? "",
              questions: taskDef.quiz.questions,
              passing_score: taskDef.quiz.passing_score ?? 70,
            })
            if (quizErr) throw quizErr
          }
        }
      }
    }
  }

  await admin.from("plans").update({ track_ids: trackIds }).eq("id", planId)

  return { planId, stats }
}

async function run() {
  console.log(`\nSeeding ${PLAN_TEMPLATES.length} plan templates…\n`)

  if (FORCE) {
    for (const name of ALL_PLAN_NAMES) {
      const existing = await findPlanByName(name)
      if (existing) {
        console.log(`⚠  --force: removing "${name}" (${existing.id})…`)
        await deletePlanTree(existing.id)
      }
    }
    console.log("")
  }

  let created = 0
  let skipped = 0

  for (const planDef of PLAN_TEMPLATES) {
    const existing = await findPlanByName(planDef.name)
    if (existing && !FORCE) {
      console.log(`ℹ  "${planDef.name}" already exists (${existing.id}) — skipped`)
      skipped++
      continue
    }

    const { planId, stats } = await insertPlan(planDef)
    created++
    console.log(`✓  "${planDef.name}"`)
    console.log(`   id: ${planId}`)
    console.log(`   tracks: ${stats.tracks} · modules: ${stats.modules} · weeks: ${stats.milestones} · tasks: ${stats.tasks} · quizzes: ${stats.quizzes}`)
    console.log("")
  }

  if (skipped && !FORCE) {
    console.log("   Re-run with --force to replace existing plans.\n")
  }

  console.log(`✅  Done (${created} created, ${skipped} skipped).`)
  console.log("   Assign Frontend, Git, or AI per cohort in Cohort Builder.\n")
  process.exit(0)
}

run().catch((err) => {
  console.error("❌  Error:", err.message)
  process.exit(1)
})
