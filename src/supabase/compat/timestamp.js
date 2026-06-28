// Firestore Timestamp compatibility helpers.
// Postgres returns ISO datetime strings; the existing UI expects Firestore
// Timestamp objects with `.toDate()` and `.seconds`. We wrap matching string
// values so that code reading those fields keeps working unchanged.

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

export function wrapTimestamp(value) {
  if (value == null) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const ms = date.getTime()
  return {
    _isTimestamp: true,
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1e6,
    toDate: () => new Date(ms),
    toMillis: () => ms,
    valueOf: () => ms,
    toString: () => date.toISOString(),
    toJSON: () => date.toISOString(),
  }
}

export function isTimestampString(value) {
  return typeof value === "string" && ISO_DATETIME.test(value)
}

// The Firestore `Timestamp` named export. Only `.now()` / `.fromDate()` are
// realistically used; the rest mirror the SDK surface for safety.
export const Timestamp = {
  now: () => wrapTimestamp(new Date()),
  fromDate: (date) => wrapTimestamp(date),
  fromMillis: (ms) => wrapTimestamp(new Date(ms)),
}

// Transform a raw Postgres row into a Firestore-style document body:
// top-level ISO datetime strings become Timestamp objects. Nested objects and
// arrays (jsonb) are left untouched so values stored as ISO strings inside them
// continue to be parsed via `new Date(...)` by existing code.
export function transformRow(row) {
  if (!row || typeof row !== "object") return row
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = isTimestampString(value) ? wrapTimestamp(value) : value
  }
  return out
}
