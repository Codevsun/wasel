import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, doc, getDocs,
  updateDoc, arrayUnion, query, where, serverTimestamp,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Layers, Plus, Users, ChevronDown, ChevronRight, CalendarDays,
  BookOpen, FolderOpen,
} from "lucide-react"
import { cn } from "../../lib/utils"

function formatDate(ts) {
  if (!ts) return "—"
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const TYPE_COLORS = {
  solo: "default",
  group: "secondary",
  program: "success",
}

export default function CohortBuilder() {
  const { user } = useAuth()

  const [cohorts, setCohorts] = useState([])
  const [plans, setPlans] = useState([])
  const [interns, setInterns] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(new Set())

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    type: "solo",
    plan_id: "",
    start_date: "",
    member_uids: [],
  })
  const [creating, setCreating] = useState(false)

  // Add group inside program cohort
  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [addGroupCohort, setAddGroupCohort] = useState(null)
  const [groupName, setGroupName] = useState("")
  const [addingGroup, setAddingGroup] = useState(false)

  useEffect(() => {
    const unsubs = []

    unsubs.push(
      onSnapshot(collection(db, "cohorts"), (snap) => {
        setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, console.error)
    )

    getDocs(collection(db, "plans")).then((snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    const internQ = query(collection(db, "users"), where("role", "==", "intern"))
    getDocs(internQ).then((snap) => {
      setInterns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    unsubs.push(
      onSnapshot(collection(db, "progress"), (snap) => {
        const map = {}
        snap.docs.forEach((d) => { map[d.id] = d.data() })
        setProgressMap(map)
      }, console.error)
    )

    return () => unsubs.forEach((u) => u())
  }, [])

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleMember = (uid) => {
    setForm((f) => ({
      ...f,
      member_uids: f.member_uids.includes(uid)
        ? f.member_uids.filter((id) => id !== uid)
        : [...f.member_uids, uid],
    }))
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const docRef = await addDoc(collection(db, "cohorts"), {
        name: form.name.trim(),
        type: form.type,
        plan_id: form.plan_id || null,
        start_date: form.start_date ? new Date(form.start_date) : null,
        member_uids: form.member_uids,
        group_ids: [],
        created_by: user?.uid,
        created_at: serverTimestamp(),
      })

      // Update each selected intern's cohort_ids
      await Promise.all(
        form.member_uids.map((uid) =>
          updateDoc(doc(db, "users", uid), { cohort_ids: arrayUnion(docRef.id) })
        )
      )

      setCreateOpen(false)
      setForm({ name: "", type: "solo", plan_id: "", start_date: "", member_uids: [] })
    } catch (err) {
      console.error(err)
      alert("Failed to create cohort: " + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleAddGroup = async () => {
    if (!groupName.trim() || !addGroupCohort) return
    setAddingGroup(true)
    try {
      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        cohort_id: addGroupCohort.id,
        member_uids: [],
        plan_id: addGroupCohort.plan_id || null,
        created_by: user?.uid,
      })
      await updateDoc(doc(db, "cohorts", addGroupCohort.id), {
        group_ids: arrayUnion(groupRef.id),
      })
      setAddGroupOpen(false)
      setGroupName("")
      setAddGroupCohort(null)
    } catch (err) {
      console.error(err)
      alert("Failed to add group: " + err.message)
    } finally {
      setAddingGroup(false)
    }
  }

  const internMap = Object.fromEntries(interns.map((i) => [i.id, i]))
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cohort Builder</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage intern cohorts, groups, and programs.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Cohort
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : cohorts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No cohorts yet</p>
            <p className="text-sm">Create your first cohort to get started.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Cohort
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cohorts.map((cohort) => {
            const isOpen = expanded.has(cohort.id)
            const memberCount = (cohort.member_uids || []).length
            const plan = planMap[cohort.plan_id]
            const avgProgress =
              cohort.member_uids?.length > 0
                ? cohort.member_uids.reduce((sum, uid) => {
                    const p = progressMap[uid]
                    return sum + (p?.overall_pct ?? 0)
                  }, 0) / cohort.member_uids.length
                : null

            return (
              <Card key={cohort.id} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => toggleExpand(cohort.id)}
                >
                  <CardHeader className="flex flex-row items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{cohort.name}</span>
                        <Badge variant={TYPE_COLORS[cohort.type] || "outline"} className="text-xs capitalize">
                          {cohort.type}
                        </Badge>
                        {plan && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <BookOpen className="h-3 w-3" />
                            {plan.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {memberCount} member{memberCount !== 1 ? "s" : ""}
                        </span>
                        {cohort.start_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Started {formatDate(cohort.start_date)}
                          </span>
                        )}
                        {avgProgress !== null && (
                          <span>Avg. {Math.round(avgProgress)}% complete</span>
                        )}
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </CardHeader>
                </button>

                {isOpen && (
                  <CardContent className="pt-0 pb-4 space-y-4">
                    <Separator />

                    {/* Members */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Members</h4>
                      {memberCount === 0 ? (
                        <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(cohort.member_uids || []).map((uid) => {
                            const intern = internMap[uid]
                            const prog = progressMap[uid]
                            if (!intern) return null
                            return (
                              <div key={uid} className="flex items-center gap-3">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {intern.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate">{intern.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                      {prog ? `${Math.round(prog.overall_pct ?? 0)}%` : "—"}
                                    </span>
                                  </div>
                                  {prog && (
                                    <Progress value={prog.overall_pct ?? 0} className="h-1 mt-1" />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Groups (for program cohorts) */}
                    {cohort.type === "program" && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Groups</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setAddGroupCohort(cohort); setAddGroupOpen(true) }}
                          >
                            <Plus className="h-3 w-3" />
                            Add Group
                          </Button>
                        </div>
                        {(cohort.group_ids || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No groups yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {(cohort.group_ids || []).map((gid) => (
                              <div key={gid} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Group {gid.slice(-6)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Cohort Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Cohort</DialogTitle>
            <DialogDescription>Set up a new intern cohort with a plan and members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Cohort Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Cohort 7 - Frontend"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assign Plan (optional)</Label>
              <Select
                value={form.plan_id}
                onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plan</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.is_template && "(template)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Add Members ({form.member_uids.length} selected)
              </Label>
              <div className="max-h-48 overflow-y-auto border border-input rounded-md divide-y divide-border">
                {interns.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No interns available</p>
                ) : (
                  interns.map((intern) => {
                    const sel = form.member_uids.includes(intern.id)
                    return (
                      <label
                        key={intern.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleMember(intern.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {intern.name?.slice(0, 2).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{intern.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{intern.email}</p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={!form.name.trim() || creating}>
              {creating ? "Creating..." : "Create Cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Group Dialog */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>
              Add a new group inside{" "}
              <span className="font-medium">{addGroupCohort?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Group Name</Label>
            <Input
              placeholder="e.g. Team Alpha"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddGroup} disabled={!groupName.trim() || addingGroup}>
              {addingGroup ? "Adding..." : "Add Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
