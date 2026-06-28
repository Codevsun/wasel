// Firebase Analytics-compatible no-op stubs. Vite aliases redirect
// `firebase/analytics` here. Supabase has no analytics equivalent; these keep
// imports working without doing anything.

export const analytics = { __isSupabaseAnalytics: true }

export function getAnalytics() {
  return analytics
}

export function logEvent() {
  /* no-op */
}

export function isSupported() {
  return Promise.resolve(false)
}
