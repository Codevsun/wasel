// Supabase Edge Function: createUserAccount
//
// Replaces the Firebase Cloud Function of the same name. A trainer calls this
// (via the Functions compat layer -> supabase.functions.invoke) to create a new
// intern/management account WITHOUT replacing the trainer's own session.
//
// It:
//   1. Verifies the caller is an authenticated trainer.
//   2. Creates the auth user (service role) with role in app_metadata.
//   3. Inserts the users row and updates cohort/group membership.
//
// Deploy:  supabase functions deploy createUserAccount
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are
//          provided automatically by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function addUnique(arr: unknown, value: string): string[] {
  const list = Array.isArray(arr) ? (arr as string[]) : []
  return list.includes(value) ? list : [...list, value]
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  try {
    // 1. Authenticate the caller and verify trainer role.
    const authHeader = req.headers.get("Authorization") ?? ""
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser()

    if (callerErr || !caller) return json({ error: "You must be signed in." }, 401)

    const callerRole =
      (caller.app_metadata as Record<string, unknown>)?.role ??
      (caller.user_metadata as Record<string, unknown>)?.role
    if (callerRole !== "trainer") {
      return json({ error: "Only trainers can perform this action." }, 403)
    }

    // 2. Validate payload.
    const {
      name,
      email,
      password,
      role,
      track_preference = [],
      cohort_id = null,
      group_id = null,
      note = "",
    } = await req.json()

    if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
      return json({ error: "name, email, password, and role are required." }, 400)
    }
    if (!["intern", "management"].includes(role)) {
      return json({ error: "Role must be intern or management." }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 3. Create the auth user with role baked into app_metadata.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
      app_metadata: { role },
    })
    if (createErr) {
      const msg = /already/i.test(createErr.message)
        ? "An account with this email already exists."
        : createErr.message
      return json({ error: msg }, 400)
    }
    const uid = created.user.id

    // 4. Insert the users row.
    const { error: rowErr } = await admin.from("users").upsert({
      id: uid,
      name: name.trim(),
      email: email.trim(),
      role,
      track_preference,
      cohort_ids: cohort_id ? [cohort_id] : [],
      group_ids: group_id ? [group_id] : [],
      note: (note ?? "").trim(),
      status: "active",
      created_at: new Date().toISOString(),
      last_active: null,
    })
    if (rowErr) return json({ error: rowErr.message }, 500)

    // 5. Update cohort / group membership.
    if (cohort_id) {
      const { data: cohort } = await admin
        .from("cohorts")
        .select("member_uids")
        .eq("id", cohort_id)
        .maybeSingle()
      await admin
        .from("cohorts")
        .update({ member_uids: addUnique(cohort?.member_uids, uid) })
        .eq("id", cohort_id)
    }
    if (group_id) {
      const { data: group } = await admin
        .from("groups")
        .select("member_uids")
        .eq("id", group_id)
        .maybeSingle()
      await admin
        .from("groups")
        .update({ member_uids: addUnique(group?.member_uids, uid) })
        .eq("id", group_id)
    }

    return json({ uid, email: email.trim(), name: name.trim() })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
