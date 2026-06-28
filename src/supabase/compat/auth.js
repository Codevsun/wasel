// Firebase Auth-compatible API implemented on top of Supabase Auth.
// Vite aliases redirect `firebase/auth` imports to this module.

import { supabase } from "../client"

export const auth = { __isSupabaseAuth: true }

// Map a Supabase user into the Firebase-like shape the app expects.
// The user's role is carried in the JWT (app_metadata.role), set server-side
// by the admin Edge Function. AuthContext also falls back to the users row.
function mapUser(u) {
  if (!u) return null
  const role = u.app_metadata?.role ?? u.user_metadata?.role ?? null
  return {
    uid: u.id,
    email: u.email,
    displayName: u.user_metadata?.name ?? null,
    emailVerified: !!u.email_confirmed_at,
    getIdTokenResult: async () => ({ claims: { role } }),
    getIdToken: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    },
  }
}

export function getAuth() {
  return auth
}

// onAuthStateChanged(auth, callback) -> unsubscribe
export function onAuthStateChanged(_auth, callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Defer out of the Supabase callback: the listener must not await other
    // supabase calls synchronously (the app sets up queries from here).
    setTimeout(() => callback(mapUser(session?.user ?? null)), 0)
  })
  return () => {
    try {
      data.subscription.unsubscribe()
    } catch {
      /* ignore */
    }
  }
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const e = new Error(error.message)
    e.code = error.code || "auth/invalid-credential"
    throw e
  }
  return { user: mapUser(data.user) }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function sendPasswordResetEmail(_auth, email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}

// Provided for completeness. Client-side account creation is intentionally
// handled by the admin Edge Function (see CreateAccount.jsx) so the trainer's
// session is not replaced; this remains as a thin fallback.
export async function createUserWithEmailAndPassword(_auth, email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return { user: mapUser(data.user) }
}

export async function updatePassword(_user, newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
