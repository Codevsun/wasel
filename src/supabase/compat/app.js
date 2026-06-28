// Firebase App-compatible stubs. Vite aliases redirect `firebase/app` here.
// The Supabase client is a singleton initialized in src/supabase/client.js, so
// there is no real "app" to initialize. These exist only to satisfy imports.

export function initializeApp() {
  return { __isSupabaseApp: true }
}

export function getApp() {
  return { __isSupabaseApp: true }
}

export function getApps() {
  return [{ __isSupabaseApp: true }]
}

export function deleteApp() {
  return Promise.resolve()
}
