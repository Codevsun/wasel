/** Sort modules by track order, then module order. */
export function sortModulesByTrack(modules, tracks) {
  const trackOrder = Object.fromEntries(
    [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((t, i) => [t.id, i])
  )
  return [...modules].sort((a, b) => {
    const trackCmp = (trackOrder[a.track_id] ?? 0) - (trackOrder[b.track_id] ?? 0)
    if (trackCmp !== 0) return trackCmp
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

/** Build module_schedule with start_week computed sequentially from week durations. */
export function buildModuleSchedule(modules, tracks, weekByModuleId) {
  const sorted = sortModulesByTrack(modules, tracks)
  let cursor = 1
  const schedule = {}

  for (const mod of sorted) {
    const weeks = Math.max(1, Number(weekByModuleId[mod.id]) || 1)
    schedule[mod.id] = { weeks, start_week: cursor }
    cursor += weeks
  }

  return schedule
}

/** Draft week values keyed by module id (from cohort doc or defaults). */
export function draftWeeksFromCohort(cohort, modules) {
  const draft = {}
  for (const mod of modules) {
    draft[mod.id] = cohort.module_schedule?.[mod.id]?.weeks ?? 1
  }
  return draft
}

/** Calendar placements keyed by module id. */
export function draftPlacementsFromCohort(cohort, modules, tracks) {
  const hasSaved = cohort.module_schedule && Object.keys(cohort.module_schedule).length > 0

  if (hasSaved) {
    const placements = {}
    for (const mod of modules) {
      const saved = cohort.module_schedule[mod.id]
      placements[mod.id] = saved
        ? { start_week: saved.start_week, weeks: Math.max(1, saved.weeks) }
        : { start_week: 1, weeks: 1 }
    }
    return placements
  }

  const weekByModuleId = draftWeeksFromCohort(cohort, modules)
  return buildModuleSchedule(modules, tracks, weekByModuleId)
}

export function placementsToModuleSchedule(placements) {
  const schedule = {}
  for (const [id, placement] of Object.entries(placements)) {
    schedule[id] = {
      start_week: placement.start_week,
      weeks: Math.max(1, Number(placement.weeks) || 1),
    }
  }
  return schedule
}

export function sumModuleWeeks(weekByModuleId) {
  return Object.values(weekByModuleId).reduce((sum, w) => sum + (Number(w) || 0), 0)
}

/** Latest week occupied by any module placement. */
export function lastScheduledWeek(placements) {
  if (!placements || !Object.keys(placements).length) return 0
  return Math.max(
    ...Object.values(placements).map((p) => p.start_week + Math.max(1, Number(p.weeks) || 1) - 1)
  )
}

export function weekDateLabel(startDate, weekIndex) {
  if (!startDate) return null
  const base = startDate?.toDate ? startDate.toDate() : new Date(startDate)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base)
  d.setDate(d.getDate() + (weekIndex - 1) * 7)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
