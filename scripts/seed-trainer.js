// One-time script to create the first trainer account.
// Usage: node scripts/seed-trainer.js
//
// Before running:
//   1. Download your service account key from Firebase Console →
//      Project Settings → Service accounts → Generate new private key
//   2. Save it as scripts/serviceAccountKey.json
//   3. Fill in TRAINER_EMAIL, TRAINER_PASSWORD, and TRAINER_NAME below

import admin from "firebase-admin"
import { createRequire } from "module"

const require = createRequire(import.meta.url)

// ── Configure these ──────────────────────────────────────────────
const TRAINER_EMAIL    = "shams@coretech.sa"
const TRAINER_PASSWORD = "ChangeMe123!"   // Trainer should change this on first login
const TRAINER_NAME     = "Shams Al-Shagawi"
// ─────────────────────────────────────────────────────────────────

let serviceAccount
try {
  serviceAccount = require("./serviceAccountKey.json")
} catch {
  console.error("❌  serviceAccountKey.json not found in scripts/")
  console.error("    Download it from: Firebase Console → Project Settings → Service accounts")
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const auth = admin.auth()
const db   = admin.firestore()

async function run() {
  console.log(`\nCreating trainer account for ${TRAINER_EMAIL}…\n`)

  // 1. Create the Auth user (or fetch if already exists)
  let uid
  try {
    const userRecord = await auth.createUser({
      email: TRAINER_EMAIL,
      password: TRAINER_PASSWORD,
      displayName: TRAINER_NAME,
    })
    uid = userRecord.uid
    console.log(`✓ Auth user created  (uid: ${uid})`)
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(TRAINER_EMAIL)
      uid = existing.uid
      console.log(`ℹ  Auth user already exists  (uid: ${uid})`)
    } else {
      throw err
    }
  }

  // 2. Set the custom claim
  await auth.setCustomUserClaims(uid, { role: "trainer" })
  console.log(`✓ Custom claim set   ({ role: "trainer" })`)

  // 3. Write the Firestore user doc
  await db.collection("users").doc(uid).set({
    name: TRAINER_NAME,
    email: TRAINER_EMAIL,
    role: "trainer",
    track_preference: [],
    note: "",
    cohort_ids: [],
    group_ids: [],
    program_id: null,
    status: "active",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_active: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log(`✓ Firestore doc written  (users/${uid})`)

  console.log(`\n✅  Done! You can now sign in at the app with:`)
  console.log(`   Email:    ${TRAINER_EMAIL}`)
  console.log(`   Password: ${TRAINER_PASSWORD}`)
  console.log(`\n   ⚠️  Change the password in Firebase Console after first login.\n`)

  process.exit(0)
}

run().catch(err => {
  console.error("❌  Error:", err.message)
  if (err.code === "auth/configuration-not-found") {
    console.error(`
    Firebase Authentication is not set up for project "${serviceAccount.project_id}".

    In Firebase Console (https://console.firebase.google.com):
      1. Open project → Build → Authentication
      2. Click "Get started" if you haven't already
      3. Sign-in method → enable "Email/Password"
      4. Re-run: npm run seed:trainer
`)
  } else if (err.code === 5 || String(err.message).includes("NOT_FOUND")) {
    console.error(`
    Cloud Firestore is not set up for project "${serviceAccount.project_id}".

    In Firebase Console (https://console.firebase.google.com):
      1. Open project → Build → Firestore Database
      2. Click "Create database"
      3. Choose a region (e.g. europe-west1 or your nearest)
      4. Start in production mode (you can add rules later)
      5. Re-run: npm run seed:trainer
`)
  }
  process.exit(1)
})
