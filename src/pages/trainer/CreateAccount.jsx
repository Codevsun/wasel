import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "../../firebase/config"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Separator } from "../../components/ui/separator"
import { Textarea } from "../../components/ui/textarea"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
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
  { value: "git", label: "Git & GitHub" },
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

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "intern",
  track_preference: [],
  cohort_id: "",
  group_id: "",
  note: "",
}

export default function CreateAccount({ open, onOpenChange }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, password: generateTempPassword() })
  const [cohorts, setCohorts] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getDocs(collection(db, "cohorts")).then((snap) => {
      setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

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
    try {
      // Account creation happens server-side in a Supabase Edge Function so the
      // trainer's own session is never replaced. The function creates the auth
      // user, assigns the role, writes the users row and updates memberships.
      const createUserAccount = httpsCallable(functions, "createUserAccount")
      await createUserAccount({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        track_preference: form.track_preference,
        cohort_id: form.cohort_id || null,
        group_id: form.group_id || null,
        note: form.note.trim(),
      })

      setSuccess({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      setForm({ ...EMPTY_FORM, password: generateTempPassword() })
    } catch (err) {
      console.error(err)
      setError(err.message || "Failed to create account.")
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = (pwd) => {
    navigator.clipboard.writeText(pwd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setSuccess(null)
    setError("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {success ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <DialogTitle className="text-green-700 dark:text-green-400">Account Created!</DialogTitle>
                  <DialogDescription>Share these credentials with the user.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="rounded-xl bg-muted/60 border border-border p-4 space-y-3 text-sm">
                {[
                  { label: "Name", value: success.name },
                  { label: "Email", value: success.email },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tracking-wide">{success.password}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyPassword(success.password)}
                      className="rounded-md h-6 w-6 hover:bg-accent transition-colors"
                    >
                      {copied
                        ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                The user should change their password after first login.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setSuccess(null)}>
                  Create Another
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Create Account</DialogTitle>
                  <DialogDescription>Add a new intern or management member.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/8 border border-destructive/20 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
                <Label htmlFor="password">Temporary Password <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="font-mono flex-1"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyPassword(form.password)}
                    className="flex items-center justify-center rounded-lg border border-input bg-background px-3 hover:bg-accent transition-colors"
                  >
                    {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, password: generateTempPassword() }))}
                  >
                    New
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Role <span className="text-destructive">*</span></Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.role === "intern" && (
                <div className="space-y-2">
                  <Label>Track Preference</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TRACK_OPTIONS.map((t) => {
                      const sel = form.track_preference.includes(t.value)
                      return (
                        <Button
                          key={t.value}
                          type="button"
                          variant="ghost"
                          onClick={() => toggleTrack(t.value)}
                          className={cn(
                            "rounded-full border px-3 py-1 h-auto text-xs font-medium transition-all cursor-pointer",
                            sel
                              ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary hover:text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:bg-secondary hover:text-secondary-foreground hover:border-primary/30"
                          )}
                        >
                          {t.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
                <Label htmlFor="note">Trainer Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Any notes about this intern..."
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
