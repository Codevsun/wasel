/** Normalize plan assignments from a cohort/group doc (supports legacy plan_id). */
export function normalizePlanAssignments(entity) {
  const assignments = entity?.plan_assignments
  if (Array.isArray(assignments) && assignments.length > 0) {
    return assignments.map((a) => ({
      plan_id: a.plan_id,
      status: a.status || "pending",
    }))
  }
  if (entity?.plan_id) {
    return [{ plan_id: entity.plan_id, status: "active" }]
  }
  return []
}

/** Active plan drives intern progress and schedule; falls back to first pending. */
export function getActivePlanId(assignments) {
  const list = Array.isArray(assignments) ? assignments : normalizePlanAssignments(assignments)
  const active = list.find((a) => a.status === "active")
  if (active) return active.plan_id
  const pending = list.find((a) => a.status === "pending")
  return pending?.plan_id || null
}

function ensureSingleActive(assignments) {
  const list = assignments.map((a) => ({ ...a }))
  const activeIdx = list.findIndex((a) => a.status === "active")
  if (activeIdx === -1) {
    const pendingIdx = list.findIndex((a) => a.status === "pending")
    if (pendingIdx !== -1) list[pendingIdx] = { ...list[pendingIdx], status: "active" }
  } else {
    list.forEach((a, i) => {
      if (i !== activeIdx && a.status === "active") list[i] = { ...a, status: "pending" }
    })
  }
  return list
}

export function addPlanAssignment(assignments, planId) {
  if (!planId || assignments.some((a) => a.plan_id === planId)) return assignments
  const hasActive = assignments.some((a) => a.status === "active")
  return [...assignments, { plan_id: planId, status: hasActive ? "pending" : "active" }]
}

export function markPlanCompleted(assignments, planId) {
  const idx = assignments.findIndex((a) => a.plan_id === planId)
  if (idx === -1) return assignments

  const next = assignments.map((a) =>
    a.plan_id === planId ? { ...a, status: "completed" } : { ...a }
  )

  if (assignments[idx].status === "active") {
    const pendingIdx = next.findIndex((a) => a.status === "pending")
    if (pendingIdx !== -1) {
      next[pendingIdx] = { ...next[pendingIdx], status: "active" }
    }
  }

  return next
}

export function removePlanAssignment(assignments, planId) {
  const item = assignments.find((a) => a.plan_id === planId)
  if (!item || item.status !== "pending") return assignments
  return assignments.filter((a) => a.plan_id !== planId)
}

/** Fields to persist on cohorts / groups. Keeps plan_id in sync for existing readers. */
export function toPlanFirestoreFields(assignments) {
  const normalized = ensureSingleActive(assignments)
  return {
    plan_assignments: normalized,
    plan_id: getActivePlanId(normalized),
  }
}

export function planAssignmentsLabel(assignments, planMap) {
  const list = normalizePlanAssignments({ plan_assignments: assignments })
  if (!list.length) return null
  const active = list.find((a) => a.status === "active")
  const completed = list.filter((a) => a.status === "completed").length
  const activeName = active ? planMap[active.plan_id]?.name : null
  if (!activeName && completed === list.length) {
    const last = list[list.length - 1]
    return `${planMap[last.plan_id]?.name || "Plan"} (all done)`
  }
  if (completed > 0) {
    return `${activeName || "Plan"} · ${completed}/${list.length} done`
  }
  return activeName || planMap[list[0].plan_id]?.name || null
}
