import { useEffect, useState } from "react"
import { initializeApp, deleteApp } from "firebase/app"
import {
  collection, getDocs, doc, setDoc, updateDoc, arrayUnion, query, where,
} from "firebase/firestore"
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { httpsCallable } from "firebase/functions"
import { db, functions, firebaseConfig } from "../../firebase/config"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Separator } from "../../components/ui/separator"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../components/ui/dialog"
import { UserPlus, Copy, CheckCheck, AlertCircle } from "lucide-react"
import { cn } from "../../lib/utils"

const TRACK_OPTIONS = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "devops", label: "DevOps" },
  { value: "ai", label: "AI / ML" },
  { value: "cloud", label: "Cloud" },
  { value: "security", label: "Security" },
]

const ROLE_OPTIONS = [
  { value: "intern", label: "Intern" },
  { value: "management", label: "Management" },
]

function generateTempPassword() {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$"
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export default function CreateAccount() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: generateTempPassword(),
    role: "intern",
    track_preference: [],
    cohort_id: "",
    group_id: "",
    note: "",
  })
  const [cohorts, setCohorts] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null) // { uid, name, email, password }
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getDocs(collection(db, "cohorts")).then((snap) => {
      setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // Load groups when cohort selected
  useEffect(() => {
    if (!form.cohort_id) {
      setGroups([])
      setForm((f) => ({ ...f, group_id: "" }))
      return
    }
    const q = query(collection(db, "groups"), where("cohort_id", "==", form.cohort_id))
    getDocs(q).then((snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [form.cohort_id])

  const toggleTrack = (value) => {
    setForm((f) => ({
      ...f,
      track_preference: f.track_preference.includes(value)
        ? f.track_preference.filter((t) => t !== value)
        : [...f.track_preference, value],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Name, email, and password are required.")
      return
    }

    setLoading(true)
    let secondaryApp = null
    try {
      // Secondary app so creating the auth user does not sign out the trainer.
      secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`)
      const secondaryAuth = getAuth(secondaryApp)
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.email.trim(),
        form.password
      )
      const uid = cred.user.uid
      await signOut(secondaryAuth)

      await setDoc(doc(db, "users", uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        track_preference: form.track_preference,
        cohort_ids: form.cohort_id ? [form.cohort_id] : [],
        group_ids: form.group_id ? [form.group_id] : [],
        note: form.note.trim(),
        status: "active",
        created_at: new Date(),
        last_active: null,
      })

      if (form.cohort_id) {
        await updateDoc(doc(db, "cohorts", form.cohort_id), {
          member_uids: arrayUnion(uid),
        })
      }

      if (form.group_id) {
        await updateDoc(doc(db, "groups", form.group_id), {
          member_uids: arrayUnion(uid),
        })
      }

      // Optional: set custom claim when Cloud Functions are deployed (Blaze plan).
      try {
        const setUserRole = httpsCallable(functions, "setUserRole")
        await setUserRole({ uid, role: form.role })
      } catch {
        // Role is stored in Firestore; rules fall back to the user doc.
      }

      setSuccess({
        uid,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      // Reset form with a new temp password
      setForm({
        name: "",
        email: "",
        password: generateTempPassword(),
        role: "intern",
        track_preference: [],
        cohort_id: "",
        group_id: "",
        note: "",
      })
    } catch (err) {
      console.error(err)
      setError(err.message || "Failed to create account.")
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(() => {})
      }
      setLoading(false)
    }
  }

  const copyPassword = () => {
    if (success?.password) {
      navigator.clipboard.writeText(success.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground text-sm">
          Create a new intern or management account and assign them to a cohort.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New User
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="Ahmad Al-Sayed"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="intern@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Temporary Password <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="font-mono"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(form.password)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, password: generateTempPassword() }))}
                >
                  Regenerate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with the user — they should change it on first login.
              </p>
            </div>

            <Separator />

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Track Preference (only for interns) */}
            {form.role === "intern" && (
              <div className="space-y-2">
                <Label>Track Preference</Label>
                <div className="flex flex-wrap gap-2">
                  {TRACK_OPTIONS.map((t) => {
                    const selected = form.track_preference.includes(t.value)
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleTrack(t.value)}
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-input bg-background text-foreground hover:bg-accent"
                        )}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Cohort + Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cohort (optional)</Label>
                <Select
                  value={form.cohort_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, cohort_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cohort</SelectItem>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Group (optional)</Label>
                <Select
                  value={form.group_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, group_id: v === "none" ? "" : v }))}
                  disabled={!form.cohort_id || groups.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!form.cohort_id ? "Select cohort first" : "No group"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note">Trainer Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Any notes about this intern..."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Success Dialog */}
      <Dialog open={!!success} onOpenChange={(open) => { if (!open) setSuccess(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCheck className="h-5 w-5" />
              Account Created
            </DialogTitle>
            <DialogDescription>
              The account has been created successfully. Share the credentials below with the user.
            </DialogDescription>
          </DialogHeader>
          {success && (
            <div className="space-y-4 mt-2">
              <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{success.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{success.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{success.password}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={copyPassword}
                    >
                      {copied
                        ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The user should change their password after first login.
              </p>
              <Button className="w-full" onClick={() => setSuccess(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
