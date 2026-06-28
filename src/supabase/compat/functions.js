// Firebase Functions-compatible API implemented on top of Supabase Edge
// Functions. Vite aliases redirect `firebase/functions` imports to this module.

import { supabase } from "../client"

export const functions = { __isSupabaseFunctions: true }

export function getFunctions() {
  return functions
}

// httpsCallable(functions, name) -> async (data) => ({ data })
export function httpsCallable(_functions, name) {
  return async (payload) => {
    const { data, error } = await supabase.functions.invoke(name, {
      body: payload ?? {},
    })
    if (error) {
      // Surface the server-provided message when available.
      let message = error.message
      try {
        const ctx = await error.context?.json?.()
        if (ctx?.error) message = ctx.error
      } catch {
        /* ignore */
      }
      const e = new Error(message)
      e.code = error.code || "functions/internal"
      throw e
    }
    return { data }
  }
}
