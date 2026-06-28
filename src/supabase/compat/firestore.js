// Firestore-compatible API implemented on top of Supabase / PostgreSQL.
//
// This shim lets the existing application code keep calling the Firebase
// Firestore SDK surface (collection/doc/query/where/onSnapshot/getDocs/...)
// while all data actually lives in Supabase. Vite aliases redirect
// `firebase/firestore` imports to this module.
//
// Conventions:
//  - Every table has a text primary key column named `id`, EXCEPT `progress`
//    and its children which are normalized and keyed by `user_id` (handled by
//    the progress store).
//  - Array/object fields are stored as jsonb so arrayUnion/arrayRemove can be
//    resolved in JS and written back wholesale.

import { supabase } from "../client"
import { Timestamp, transformRow, wrapTimestamp } from "./timestamp"
import {
  composeProgress,
  composeAllProgress,
  saveProgress,
} from "../progressStore"

export { Timestamp }

// A sentinel passed to collection()/doc() in place of the Firestore instance.
export const db = { __isSupabaseDb: true }

const SERVER_TIMESTAMP = "__serverTimestamp__"
const ARRAY_UNION = "__arrayUnion__"
const ARRAY_REMOVE = "__arrayRemove__"

/* ----------------------------- ref builders ----------------------------- */

export function collection(_db, name) {
  return { __ref: "collection", name }
}

export function doc(dbOrColl, nameOrId, maybeId) {
  // doc(db, "users", uid)
  if (dbOrColl && dbOrColl.__isSupabaseDb) {
    return { __ref: "doc", name: nameOrId, id: maybeId }
  }
  // doc(collectionRef, id) or doc(collectionRef) for an auto-id
  if (dbOrColl && dbOrColl.__ref === "collection") {
    return { __ref: "doc", name: dbOrColl.name, id: nameOrId ?? null }
  }
  // Already a doc ref (e.g. snap.ref) — pass through.
  if (dbOrColl && dbOrColl.__ref === "doc") return dbOrColl
  return { __ref: "doc", name: nameOrId, id: maybeId }
}

export function query(ref, ...constraints) {
  return { __ref: "query", name: ref.name, constraints }
}

export function where(field, op, value) {
  return { __type: "where", field, op, value }
}

export function orderBy(field, dir = "asc") {
  return { __type: "orderBy", field, dir }
}

export function limit(n) {
  return { __type: "limit", n }
}

/* ----------------------------- write sentinels ----------------------------- */

export function serverTimestamp() {
  return { __sentinel: SERVER_TIMESTAMP }
}

export function arrayUnion(...values) {
  return { __sentinel: ARRAY_UNION, values }
}

export function arrayRemove(...values) {
  return { __sentinel: ARRAY_REMOVE, values }
}

function isSentinel(v, kind) {
  return v && typeof v === "object" && v.__sentinel === kind
}

function hasArrayOp(patch) {
  return Object.values(patch).some(
    (v) => isSentinel(v, ARRAY_UNION) || isSentinel(v, ARRAY_REMOVE)
  )
}

function unionArrays(current, values) {
  const out = [...current]
  for (const v of values) {
    const exists = out.some((x) => JSON.stringify(x) === JSON.stringify(v))
    if (!exists) out.push(v)
  }
  return out
}

function removeFromArray(current, values) {
  return current.filter(
    (x) => !values.some((v) => JSON.stringify(x) === JSON.stringify(v))
  )
}

// Resolve write sentinels into concrete values. `current` is the existing row
// (only needed for arrayUnion/arrayRemove).
function resolveWrites(data, current = {}) {
  const out = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSentinel(value, SERVER_TIMESTAMP)) {
      out[key] = new Date().toISOString()
    } else if (isSentinel(value, ARRAY_UNION)) {
      out[key] = unionArrays(Array.isArray(current[key]) ? current[key] : [], value.values)
    } else if (isSentinel(value, ARRAY_REMOVE)) {
      out[key] = removeFromArray(Array.isArray(current[key]) ? current[key] : [], value.values)
    } else if (value && value._isTimestamp) {
      out[key] = value.toDate().toISOString()
    } else {
      out[key] = value
    }
  }
  return out
}

/* ----------------------------- snapshots ----------------------------- */

function makeDocSnap(name, id, row) {
  const exists = row != null
  const body = exists ? transformRow(row) : undefined
  return {
    id,
    exists: () => exists,
    data: () => body,
    get: (field) => (body ? body[field] : undefined),
    ref: { __ref: "doc", name, id },
  }
}

function makeQuerySnapshot(docs) {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn) => docs.forEach(fn),
  }
}

/* ----------------------------- query execution ----------------------------- */

function applyConstraints(builder, constraints = []) {
  for (const c of constraints) {
    if (c.__type === "where") {
      const { field, op, value } = c
      switch (op) {
        case "==": builder = builder.eq(field, value); break
        case "!=": builder = builder.neq(field, value); break
        case ">": builder = builder.gt(field, value); break
        case ">=": builder = builder.gte(field, value); break
        case "<": builder = builder.lt(field, value); break
        case "<=": builder = builder.lte(field, value); break
        case "in": builder = builder.in(field, value ?? []); break
        case "array-contains": builder = builder.contains(field, [value]); break
        case "array-contains-any": builder = builder.overlaps(field, value ?? []); break
        default: break
      }
    } else if (c.__type === "orderBy") {
      builder = builder.order(c.field, { ascending: c.dir !== "desc" })
    } else if (c.__type === "limit") {
      builder = builder.limit(c.n)
    }
  }
  return builder
}

async function runQuery(name, constraints) {
  if (name === "progress") {
    const all = await composeAllProgress()
    return makeQuerySnapshot(all.map((p) => makeDocSnap("progress", p.id, p)))
  }
  let builder = supabase.from(name).select("*")
  builder = applyConstraints(builder, constraints)
  const { data, error } = await builder
  if (error) throw error
  return makeQuerySnapshot((data ?? []).map((row) => makeDocSnap(name, row.id, row)))
}

/* ----------------------------- public reads ----------------------------- */

export async function getDocs(target) {
  return runQuery(target.name, target.constraints || [])
}

export async function getDoc(ref) {
  const { name, id } = ref
  if (name === "progress") {
    const composed = await composeProgress(id)
    return makeDocSnap("progress", id, composed)
  }
  const { data, error } = await supabase.from(name).select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return makeDocSnap(name, id, data)
}

/* ----------------------------- public writes ----------------------------- */

export async function addDoc(collRef, data) {
  const payload = resolveWrites(data)
  const { data: row, error } = await supabase
    .from(collRef.name)
    .insert(payload)
    .select("id")
    .single()
  if (error) throw error
  return { __ref: "doc", name: collRef.name, id: row.id }
}

export async function setDoc(ref, data /*, options */) {
  if (ref.name === "progress") {
    const resolved = resolveWrites(data)
    await saveProgress(ref.id, { ...resolved, id: ref.id })
    return
  }
  const payload = { ...resolveWrites(data), id: ref.id }
  const { error } = await supabase.from(ref.name).upsert(payload)
  if (error) throw error
}

export async function updateDoc(ref, patch) {
  if (ref.name === "progress") {
    const existing = (await composeProgress(ref.id)) || { id: ref.id }
    const resolved = resolveWrites(patch, existing)
    await saveProgress(ref.id, { ...existing, ...resolved })
    return
  }

  let current = {}
  if (hasArrayOp(patch)) {
    const { data } = await supabase.from(ref.name).select("*").eq("id", ref.id).maybeSingle()
    current = data || {}
  }
  const payload = resolveWrites(patch, current)
  const { error } = await supabase.from(ref.name).update(payload).eq("id", ref.id)
  if (error) throw error
}

export async function deleteDoc(ref) {
  if (ref.name === "progress") {
    await Promise.all([
      supabase.from("progress_tasks").delete().eq("user_id", ref.id),
      supabase.from("progress_milestones").delete().eq("user_id", ref.id),
      supabase.from("progress_tracks").delete().eq("user_id", ref.id),
      supabase.from("progress").delete().eq("user_id", ref.id),
    ])
    return
  }
  const { error } = await supabase.from(ref.name).delete().eq("id", ref.id)
  if (error) throw error
}

/* ----------------------------- realtime ----------------------------- */

const PROGRESS_TABLES = [
  "progress",
  "progress_tasks",
  "progress_milestones",
  "progress_tracks",
]

function subscribeTables(tables, onChange, filter) {
  const channel = supabase.channel(`rt-${Math.random().toString(36).slice(2)}`)
  for (const table of tables) {
    const cfg = { event: "*", schema: "public", table }
    if (filter) cfg.filter = filter
    channel.on("postgres_changes", cfg, onChange)
  }
  channel.subscribe()
  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      /* ignore */
    }
  }
}

// onSnapshot(ref, onNext, onError) — supports both doc refs and query/collection
// refs. Fires once immediately after the initial fetch, then on every change.
export function onSnapshot(target, onNext, onError) {
  let active = true
  const fail = (err) => {
    if (onError) onError(err)
    else console.error("[onSnapshot]", err)
  }

  if (target.__ref === "doc") {
    const { name, id } = target
    const fetchAndEmit = async () => {
      try {
        const snap = await getDoc(target)
        if (active) onNext(snap)
      } catch (err) {
        if (active) fail(err)
      }
    }
    fetchAndEmit()
    const tables = name === "progress" ? PROGRESS_TABLES : [name]
    const filter = name === "progress" ? undefined : `id=eq.${id}`
    const unsub = subscribeTables(tables, fetchAndEmit, filter)
    return () => {
      active = false
      unsub()
    }
  }

  // collection or query
  const { name, constraints } = target
  const fetchAndEmit = async () => {
    try {
      const snap = await runQuery(name, constraints || [])
      if (active) onNext(snap)
    } catch (err) {
      if (active) fail(err)
    }
  }
  fetchAndEmit()
  const tables = name === "progress" ? PROGRESS_TABLES : [name]
  const unsub = subscribeTables(tables, fetchAndEmit)
  return () => {
    active = false
    unsub()
  }
}

export { wrapTimestamp }
