// Compatibility shim. The app has migrated to Supabase; this module keeps the
// historical `../firebase/config` import path working by re-exporting the
// Supabase-backed compatibility objects. New code should import from
// `src/supabase/*` directly.

import { db } from "../supabase/compat/firestore"
import { auth } from "../supabase/compat/auth"
import { functions } from "../supabase/compat/functions"
import { storage } from "../supabase/compat/storage"
import { analytics } from "../supabase/compat/analytics"
import { supabase } from "../supabase/client"

export const app = { __isSupabaseApp: true }

// Kept for any code that referenced firebaseConfig (e.g. legacy secondary-app
// patterns). No longer used to initialize anything.
export const firebaseConfig = {}

export { db, auth, functions, storage, analytics, supabase }
