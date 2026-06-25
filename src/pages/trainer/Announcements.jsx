import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  getDocs, serverTimestamp, orderBy, query,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Textarea } from "../../components/ui/textarea"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  Bell, Plus, Trash2, Users, Layers, Globe, AlertTriangle,
  CalendarDays,
} from "lucide-react"

function formatDate(ts) {
  if (!ts) return ""
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function TargetBadge({ target, cohortMap, groupMap }) {
  if (target === "all") {
    return (
      <Badge variant="default" className="gap-1 text-xs">
        <Globe className="h-3 w-3" /> Everyone
      </Badge>
    )
  }
  if (cohortMap[target]) {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Layers className="h-3 w-3" /> {cohortMap[target].name}
      </Badge>
    )
  }
  if (groupMap[target]) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Users className="h-3 w-3" /> {groupMap[target].name}
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-xs">{target}</Badge>
}

export default function Announcements() {
  const { user } = useAuth()

  const [announcements, setAnnouncements] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [groups, setGroups] = useState([])
  const [cohortMap, setCohortMap] = useState({})
  const [groupMap, setGroupMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", target: "all", targetId: "" })
  const [creating, setCreating] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("created_at", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, console.error)

    getDocs(collection(db, "cohorts")).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setCohorts(list)
      setCohortMap(Object.fromEntries(list.map((c) => [c.id, c])))
    })

    getDocs(collection(db, "groups")).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(list)
      setGroupMap(Object.fromEntries(list.map((g) => [g.id, g])))
    })

    return unsub
  }, [])

  const resolveTarget = () => {
    if (form.target === "all") return "all"
    if (form.target === "cohort") return form.targetId || "all"
    if (form.target === "group") return form.targetId || "all"
    return "all"
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) return
    const target = resolveTarget()
    if ((form.target === "cohort" || form.target === "group") && !form.targetId) {
      alert("Please select a cohort or group.")
      return
    }
    setCreating(true)
    try {
      await addDoc(collection(db, "announcements"), {
        title: form.title.trim(),
        body: form.body.trim(),
        target,
        created_by: user?.uid,
        created_at: serverTimestamp(),
      })
      setCreateOpen(false)
      setForm({ title: "", body: "", target: "all", targetId: "" })
    } catch (err) {
      console.error(err)
      alert("Failed to create announcement: " + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "announcements", deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error(err)
      alert("Failed to delete announcement: " + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Broadcast messages to all interns, specific cohorts, or groups.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Announcement
            </Button>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm">Create your first announcement to notify interns.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{ann.title}</h3>
                      <TargetBadge
                        target={ann.target}
                        cohortMap={cohortMap}
                        groupMap={groupMap}
                      />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(ann.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setDeleteTarget(ann)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Announcement Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              This announcement will be visible to the selected audience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Announcement title..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Write your announcement here..."
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select
                value={form.target}
                onValueChange={(v) => setForm((f) => ({ ...f, target: v, targetId: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" /> All Interns
                    </span>
                  </SelectItem>
                  <SelectItem value="cohort">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" /> Specific Cohort
                    </span>
                  </SelectItem>
                  <SelectItem value="group">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> Specific Group
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.target === "cohort" && (
              <div className="space-y-1.5">
                <Label>Cohort <span className="text-destructive">*</span></Label>
                <Select
                  value={form.targetId}
                  onValueChange={(v) => setForm((f) => ({ ...f, targetId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cohort..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.length === 0 ? (
                      <SelectItem value="none" disabled>No cohorts available</SelectItem>
                    ) : (
                      cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target === "group" && (
              <div className="space-y-1.5">
                <Label>Group <span className="text-destructive">*</span></Label>
                <Select
                  value={form.targetId}
                  onValueChange={(v) => setForm((f) => ({ ...f, targetId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.length === 0 ? (
                      <SelectItem value="none" disabled>No groups available</SelectItem>
                    ) : (
                      groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.body.trim() || creating}
            >
              {creating ? "Posting..." : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Announcement
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">"{deleteTarget?.title}"</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
