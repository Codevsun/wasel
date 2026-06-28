import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surface a clear message during development if env vars are missing.
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your project credentials."
  )
}

export const supabase = createClient(url || "http://localhost", anonKey || "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase
