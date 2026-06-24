import {
  doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "../firebase/config"

export async function loadPlanStructure(planId) {
  const tracksSnap = await getDocs(
    query(collection(db, "tracks"), where("plan_id", "==", planId), orderBy("order"))
  )
  const tracks = tracksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const modules = []
  const milestones = []
  const tasks = []

  for (let i = 0; i < tracks.length; i += 10) {
    const chunk = tracks.slice(i, i + 10).map((t) => t.id)
    const snap = await getDocs(
      query(collection(db, "modules"), where("track_id", "in", chunk), orderBy("order"))
    )
    modules.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  for (let i = 0; i < modules.length; i += 10) {
    const chunk = modules.slice(i, i + 10).map((m) => m.id)
    const snap = await getDocs(
      query(collection(db, "milestones"), where("module_id", "in", chunk), orderBy("week_number"))
    )
    milestones.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  for (let i = 0; i < milestones.length; i += 10) {
    const chunk = milestones.slice(i, i + 10).map((m) => m.id)
    const snap = await getDocs(
      query(collection(db, "tasks"), where("milestone_id", "in", chunk), orderBy("order"))
    )
    tasks.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  return { tracks, modules, milestones, tasks }
}

function buildMilestoneStatus(milestones, modules) {
  const status = {}
  const sorted = [...milestones].sort((a, b) => {
    const modA = modules.find((m) => m.id === a.module_id)
    const modB = modules.find((m) => m.id === b.module_id)
    const trackOrder = (modA?.track_id || "").localeCompare(modB?.track_id || "")
    if (trackOrder !== 0) return trackOrder
    const modOrder = (modA?.order ?? 0) - (modB?.order ?? 0)
    if (modOrder !== 0) return modOrder
    return (a.week_number ?? 0) - (b.week_number ?? 0)
  })

  sorted.forEach((ms, idx) => {
    status[ms.id] = idx === 0 ? "in_progress" : "not_started"
  })
  return status
}

function recalcTrackPct(tracks, modules, milestones, tasks, completedSet) {
  const trackPct = {}
  for (const track of tracks) {
    const trackModules = modules.filter((m) => m.track_id === track.id)
    const trackMilestones = milestones.filter((ms) =>
      trackModules.some((m) => m.id === ms.module_id)
    )
    const trackTasks = tasks.filter((t) =>
      trackMilestones.some((ms) => ms.id === t.milestone_id)
    )
    if (!trackTasks.length) {
      trackPct[track.id] = 0
      continue
    }
    const done = trackTasks.filter((t) => completedSet.has(t.id)).length
    trackPct[track.id] = Math.round((done / trackTasks.length) * 100)
  }
  return trackPct
}

function updateMilestoneStatus(milestoneStatus, milestones, modules, tasks, completedSet) {
  const next = { ...milestoneStatus }
  const sorted = [...milestones].sort((a, b) => {
    const modA = modules.find((m) => m.id === a.module_id)
    const modB = modules.find((m) => m.id === b.module_id)
    const trackOrder = (modA?.track_id || "").localeCompare(modB?.track_id || "")
    if (trackOrder !== 0) return trackOrder
    const modOrder = (modA?.order ?? 0) - (modB?.order ?? 0)
    if (modOrder !== 0) return modOrder
    return (a.week_number ?? 0) - (b.week_number ?? 0)
  })

  for (const ms of sorted) {
    const msTasks = tasks.filter((t) => t.milestone_id === ms.id)
    if (!msTasks.length) continue
    const allDone = msTasks.every((t) => completedSet.has(t.id))
    if (allDone) {
      next[ms.id] = "completed"
    } else if (msTasks.some((t) => completedSet.has(t.id))) {
      next[ms.id] = "in_progress"
    }
  }

  let foundActive = false
  for (const ms of sorted) {
    if (next[ms.id] === "completed") continue
    if (!foundActive) {
      if (next[ms.id] === "not_started") next[ms.id] = "in_progress"
      foundActive = true
    }
  }

  return next
}

function buildProgressPayload(planId, cohortId, { tracks, modules, milestones, tasks }, completedTaskIds) {
  const validIds = new Set(tasks.map((t) => t.id))
  const completed = completedTaskIds.filter((id) => validIds.has(id))
  const completedSet = new Set(completed)
  const totalTasks = tasks.length || 1

  const baseMilestones = buildMilestoneStatus(milestones, modules)
  const milestone_status = updateMilestoneStatus(
    baseMilestones,
    milestones,
    modules,
    tasks,
    completedSet
  )

  return {
    plan_id: planId,
    cohort_id: cohortId,
    total_tasks: totalTasks,
    completed_tasks: completed,
    overall_pct: Math.min(100, Math.round((completed.length / totalTasks) * 100)),
    milestone_status,
    track_pct: recalcTrackPct(tracks, modules, milestones, tasks, completedSet),
    last_active: serverTimestamp(),
  }
}

/** plan_id → { [milestoneId]: { title, week_number } } */
export async function loadMilestoneLabels(planId) {
  if (!planId) return {}
  const { milestones } = await loadPlanStructure(planId)
  const map = {}
  milestones.forEach((ms) => {
    map[ms.id] = {
      title: ms.title || `Week ${ms.week_number ?? "?"}`,
      week_number: ms.week_number ?? 0,
    }
  })
  return map
}

/** plan_id → { [trackId]: label } */
export async function loadTrackLabels(planId) {
  if (!planId) return {}
  const snap = await getDocs(
    query(collection(db, "tracks"), where("plan_id", "==", planId))
  )
  const map = {}
  snap.docs.forEach((d) => {
    const data = d.data()
    map[d.id] = data.label || data.category || d.id
  })
  return map
}

/** Align progress/{uid} with the intern's current cohort plan (creates or re-syncs on plan change). */
export async function syncProgressWithCohort(uid, cohortId) {
  if (!cohortId) {
    const userSnap = await getDoc(doc(db, "users", uid))
    cohortId = userSnap.data()?.cohort_ids?.[0]
  }
  if (!cohortId) return null

  const cohortSnap = await getDoc(doc(db, "cohorts", cohortId))
  if (!cohortSnap.exists()) return null
  const planId = cohortSnap.data().plan_id
  if (!planId) return null

  const progRef = doc(db, "progress", uid)
  const existing = await getDoc(progRef)
  const existingData = existing.exists() ? existing.data() : null

  const structure = await loadPlanStructure(planId)
  const payload = buildProgressPayload(
    planId,
    cohortId,
    structure,
    existingData?.completed_tasks || []
  )

  const completedUnchanged =
    JSON.stringify([...(existingData?.completed_tasks || [])].sort()) ===
    JSON.stringify([...payload.completed_tasks].sort())

  const metricsMatch =
    existingData?.overall_pct === payload.overall_pct &&
    JSON.stringify(existingData?.track_pct || {}) === JSON.stringify(payload.track_pct) &&
    JSON.stringify(existingData?.milestone_status || {}) === JSON.stringify(payload.milestone_status)

  const unchanged =
    existingData &&
    existingData.plan_id === planId &&
    existingData.cohort_id === cohortId &&
    existingData.total_tasks === structure.tasks.length &&
    completedUnchanged &&
    metricsMatch

  if (unchanged) return existingData

  await setDoc(progRef, payload)
  return payload
}

/** @deprecated alias — use syncProgressWithCohort */
export async function ensureProgressDoc(uid, cohortId) {
  return syncProgressWithCohort(uid, cohortId)
}

/** Trainer marks a milestone complete before the intern finishes all tasks. */
export async function forceCloseMilestone(uid, milestoneId) {
  const progRef = doc(db, "progress", uid)
  const snap = await getDoc(progRef)
  if (!snap.exists()) return

  const data = snap.data()
  const milestoneStatus = { ...(data.milestone_status || {}) }
  milestoneStatus[milestoneId] = "completed"

  if (data.plan_id) {
    const { modules, milestones } = await loadPlanStructure(data.plan_id)
    const sorted = [...milestones].sort((a, b) => {
      const modA = modules.find((m) => m.id === a.module_id)
      const modB = modules.find((m) => m.id === b.module_id)
      const trackOrder = (modA?.track_id || "").localeCompare(modB?.track_id || "")
      if (trackOrder !== 0) return trackOrder
      const modOrder = (modA?.order ?? 0) - (modB?.order ?? 0)
      if (modOrder !== 0) return modOrder
      return (a.week_number ?? 0) - (b.week_number ?? 0)
    })

    let foundActive = false
    for (const ms of sorted) {
      if (milestoneStatus[ms.id] === "completed") continue
      if (!foundActive) {
        if (milestoneStatus[ms.id] === "not_started") milestoneStatus[ms.id] = "in_progress"
        foundActive = true
      }
    }
  } else {
    const nextNotStarted = Object.entries(milestoneStatus).find(
      ([id, s]) => id !== milestoneId && s === "not_started"
    )
    if (nextNotStarted) milestoneStatus[nextNotStarted[0]] = "in_progress"
  }

  await updateDoc(progRef, {
    milestone_status: milestoneStatus,
    trainer_closed_milestones: [...new Set([...(data.trainer_closed_milestones || []), milestoneId])],
    last_active: serverTimestamp(),
  })
}

/** Record a completed task and recalculate progress metrics trainers read. */
export async function markTaskCompleted(uid, taskId, { cohortId } = {}) {
  const progRef = doc(db, "progress", uid)
  let progSnap = await getDoc(progRef)

  if (!progSnap.exists()) {
    await syncProgressWithCohort(uid, cohortId)
    progSnap = await getDoc(progRef)
  } else if (cohortId) {
    const cohortSnap = await getDoc(doc(db, "cohorts", cohortId))
    const planId = cohortSnap.data()?.plan_id
    const progPlanId = progSnap.data()?.plan_id
    if (planId && progPlanId !== planId) {
      await syncProgressWithCohort(uid, cohortId)
      progSnap = await getDoc(progRef)
    }
  }

  const data = progSnap.exists() ? progSnap.data() : {}
  const completed = Array.from(new Set([...(data.completed_tasks || []), taskId]))
  const totalTasks = data.total_tasks || completed.length
  const completedSet = new Set(completed)

  const patch = {
    completed_tasks: completed,
    overall_pct: Math.min(100, Math.round((completed.length / totalTasks) * 100)),
    last_active: serverTimestamp(),
  }

  if (data.plan_id) {
    const { tracks, modules, milestones, tasks } = await loadPlanStructure(data.plan_id)
    patch.track_pct = recalcTrackPct(tracks, modules, milestones, tasks, completedSet)
    patch.milestone_status = updateMilestoneStatus(
      data.milestone_status || {},
      milestones,
      modules,
      tasks,
      completedSet
    )
  }

  if (progSnap.exists()) {
    await updateDoc(progRef, patch)
  } else {
    await setDoc(progRef, {
      total_tasks: totalTasks,
      milestone_status: {},
      track_pct: {},
      plan_id: null,
      ...patch,
    })
  }
}
