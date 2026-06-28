import {
  collection, getDocs, onSnapshot, orderBy, query, limit,
} from "firebase/firestore"
import { db } from "../firebase/config"

/** Normalize target from text, jsonb string, or legacy { type, id } shape. */
export function normalizeAnnouncementTarget(target) {
  if (target == null) return null
  if (typeof target === "string") return target
  if (typeof target === "object") return target.id || target.type || null
  return String(target)
}

export function announcementTargetsForUser(userDoc) {
  const targets = new Set(["all"])
  for (const id of userDoc?.cohort_ids || []) targets.add(id)
  for (const id of userDoc?.group_ids || []) targets.add(id)
  return targets
}

export function filterAnnouncementsForUser(announcements, userDoc) {
  const targets = announcementTargetsForUser(userDoc)
  return announcements.filter((ann) =>
    targets.has(normalizeAnnouncementTarget(ann.target))
  )
}

/**
 * Fetch announcements visible to an intern.
 * Target is stored as jsonb in Postgres, so server-side `in` filters fail;
 * we fetch recent rows and filter client-side.
 */
export async function fetchAnnouncementsForUser(userDoc, { maxResults = 5, fetchLimit = 50 } = {}) {
  const snap = await getDocs(
    query(
      collection(db, "announcements"),
      orderBy("created_at", "desc"),
      limit(fetchLimit)
    )
  )
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return filterAnnouncementsForUser(all, userDoc).slice(0, maxResults)
}

/** Real-time listener for announcements visible to an intern. */
export function subscribeAnnouncementsForUser(userDoc, onUpdate, onError) {
  const q = query(
    collection(db, "announcements"),
    orderBy("created_at", "desc"),
    limit(50)
  )
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      onUpdate(filterAnnouncementsForUser(all, userDoc).slice(0, 5))
    },
    onError
  )
}
