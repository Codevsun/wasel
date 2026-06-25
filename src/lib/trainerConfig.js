import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "../firebase/config"

const CONFIG_REF = doc(db, "config", "trainer_settings")

export const LABEL_COLOR_OPTIONS = [
  { key: "green",  label: "Green",  classes: "bg-green-500/10 text-green-600 border-green-500/20" },
  { key: "blue",   label: "Blue",   classes: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { key: "purple", label: "Purple", classes: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { key: "amber",  label: "Amber",  classes: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  { key: "orange", label: "Orange", classes: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { key: "red",    label: "Red",    classes: "bg-red-500/10 text-red-600 border-red-500/20" },
  { key: "pink",   label: "Pink",   classes: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  { key: "indigo", label: "Indigo", classes: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  { key: "slate",  label: "Gray",   classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
]

export const DEFAULT_TRACKS = [
  "Frontend", "Backend", "Fullstack", "Security", "DevOps",
  "Mobile", "Data", "Cloud", "AI/ML", "QA", "Design",
]

export const DEFAULT_LABELS = [
  { name: "High Performer", color: "green" },
  { name: "Fast Learner",   color: "blue" },
  { name: "Project Ready",  color: "purple" },
  { name: "Mentor Recommended", color: "amber" },
  { name: "Needs Support",  color: "orange" },
  { name: "Struggling",     color: "red" },
]

export function getLabelClasses(colorKey) {
  return LABEL_COLOR_OPTIONS.find((c) => c.key === colorKey)?.classes
    ?? "bg-muted text-muted-foreground border-border"
}

export function subscribeToTrainerConfig(callback) {
  return onSnapshot(CONFIG_REF, (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      callback({
        tracks: data.tracks ?? DEFAULT_TRACKS,
        labels: data.labels ?? DEFAULT_LABELS,
      })
    } else {
      callback({ tracks: DEFAULT_TRACKS, labels: DEFAULT_LABELS })
    }
  })
}

export async function saveTrainerConfig(patch) {
  await setDoc(CONFIG_REF, patch, { merge: true })
}
