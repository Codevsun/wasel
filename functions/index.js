const { onCall, HttpsError } = require("firebase-functions/v2/https")
const { setGlobalOptions } = require("firebase-functions/v2")
const admin = require("firebase-admin")

admin.initializeApp()
setGlobalOptions({ region: "us-central1" })

const db = admin.firestore()

function requireTrainer(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.")
  }
  if (request.auth.token.role !== "trainer") {
    throw new HttpsError("permission-denied", "Only trainers can perform this action.")
  }
}

exports.setUserRole = onCall(async (request) => {
  requireTrainer(request)

  const { uid, role } = request.data || {}
  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "uid and role are required.")
  }
  if (!["intern", "trainer", "management"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.")
  }

  await admin.auth().setCustomUserClaims(uid, { role })
  return { success: true }
})

exports.createUserAccount = onCall(async (request) => {
  requireTrainer(request)

  const {
    name,
    email,
    password,
    role,
    track_preference = [],
    cohort_id = null,
    group_id = null,
    note = "",
  } = request.data || {}

  if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
    throw new HttpsError("invalid-argument", "name, email, password, and role are required.")
  }
  if (!["intern", "management"].includes(role)) {
    throw new HttpsError("invalid-argument", "Role must be intern or management.")
  }

  let uid
  try {
    const userRecord = await admin.auth().createUser({
      email: email.trim(),
      password,
      displayName: name.trim(),
    })
    uid = userRecord.uid
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists.")
    }
    throw new HttpsError("internal", err.message)
  }

  await admin.auth().setCustomUserClaims(uid, { role })

  await db.collection("users").doc(uid).set({
    name: name.trim(),
    email: email.trim(),
    role,
    track_preference,
    cohort_ids: cohort_id ? [cohort_id] : [],
    group_ids: group_id ? [group_id] : [],
    note: note.trim(),
    status: "active",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_active: null,
  })

  if (cohort_id) {
    await db.collection("cohorts").doc(cohort_id).update({
      member_uids: admin.firestore.FieldValue.arrayUnion(uid),
    })
  }

  if (group_id) {
    await db.collection("groups").doc(group_id).update({
      member_uids: admin.firestore.FieldValue.arrayUnion(uid),
    })
  }

  return { uid, email: email.trim(), name: name.trim() }
})
