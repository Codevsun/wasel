import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, doc, getDocs,
  updateDoc, arrayUnion, arrayRemove, query, where, serverTimestamp, deleteDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { loadPlanStructure } from "../../lib/progress"
import { draftPlacementsFromCohort, lastScheduledWeek, placementsToModuleSchedule } from "../../lib/cohortSchedule"
import PlanScheduleCalendar from "../../components/trainer/PlanScheduleCalendar"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Checkbox } from "../../components/ui/checkbox"
import { Skeleton } from "../../components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../../components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible"
import {
  Layers, Plus, Users, CalendarDays, BookOpen, Trash2, Save,
  UserPlus, UserMinus, Settings, ArrowLeft, User, FolderOpen, ChevronRight, Search,
} from "lucide-react"
import { cn } from "../../lib/utils"

function formatDate(ts) {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const TYPE_META = {
  solo:    { color: "secondary", icon: User,   label: "Solo",  desc: "One intern, one plan" },
  group:   { color: "outline",   icon: Users,  label: "Group", desc: "Multiple interns, shared plan" },
  program: { color: "default",   icon: Layers, label: "Batch", desc: "Multiple groups under one umbrella" },
}

// ── Intern Queue-style picker dialog ─────────────────────────────────────────

function InternPickerDialog({ open, onOpenChange, available, selected: sel, onToggle, maxOne = false, title, onConfirm, loading }) {
  const [search, setSearch] = useState("")
  const filtered = available.filter((i) =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSearch(""); onOpenChange(v) }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>{title || "Add Interns"}</DialogTitle>
          {maxOne && (
            <DialogDescription>Select one intern to assign.</DialogDescription>
          )}
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Count + select all */}
        {!maxOne && (
          <div className="flex items-center justify-between px-5 py-1.5 border-y border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">{filtered.length} intern{filtered.length !== 1 ? "s" : ""}</span>
            {filtered.length > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const allSelected = filtered.every((i) => sel.includes(i.id))
                  filtered.forEach((i) => {
                    if (allSelected && sel.includes(i.id)) onToggle(i.id)
                    else if (!allSelected && !sel.includes(i.id)) onToggle(i.id)
                  })
                }}
              >
                {filtered.every((i) => sel.includes(i.id)) ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
        )}

        {/* Intern list */}
        <div className="overflow-y-auto max-h-80 divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <User className="h-7 w-7 mb-2 opacity-20" />
              <p className="text-sm">{search ? "No interns match your search" : "No interns available"}</p>
            </div>
          ) : filtered.map((intern) => {
            const checked  = sel.includes(intern.id)
            const disabled = maxOne && !checked && sel.length >= 1
            return (
              <label
                key={intern.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 transition-colors",
                  disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/50",
                  checked && "bg-accent/30"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => !disabled && onToggle(intern.id)}
                  className="shrink-0"
                />
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-muted font-medium">
                    {intern.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{intern.name}</span>
                    {intern.status && (
                      <Badge variant={intern.status === "active" ? "outline" : "secondary"} className="text-xs capitalize">
                        {intern.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{intern.email}</p>
                </div>
                {checked && (
                  <div className="shrink-0 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
                    <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </label>
            )
          })}
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border">
          <span className="text-sm text-muted-foreground mr-auto">
            {sel.length > 0 ? `${sel.length} selected` : ""}
          </span>
          <Button variant="outline" onClick={() => { setSearch(""); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={() => { setSearch(""); onConfirm() }} disabled={!sel.length || loading}>
            {loading ? "Adding…" : `Add${sel.length > 0 ? ` (${sel.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CohortBuilder() {
  const { user } = useAuth()

  const [cohorts, setCohorts]           = useState([])
  const [plans, setPlans]               = useState([])
  const [interns, setInterns]           = useState([])
  const [progressMap, setProgressMap]   = useState({})
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState("all")
  const [selectedId, setSelectedId]     = useState(null)
  const [groupsMap, setGroupsMap]       = useState({})
  const [loadingGroups, setLoadingGroups] = useState(false)

  // create
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState({ name: "", type: "solo", plan_id: "", start_date: "", member_uids: [] })
  const [creating, setCreating]     = useState(false)

  // delete cohort
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // add / remove members (cohort)
  const [addMembersOpen, setAddMembersOpen] = useState(false)
  const [addMemberUids, setAddMemberUids]   = useState([])
  const [addingMembers, setAddingMembers]   = useState(false)
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null)
  const [removingMember, setRemovingMember]         = useState(false)

  // groups
  const [newGroupOpen, setNewGroupOpen]   = useState(false)
  const [newGroupForm, setNewGroupForm]   = useState({ name: "", plan_id: "", member_uids: [] })
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
  const [deletingGroup, setDeletingGroup]         = useState(false)
  const [addGroupMembersOpen, setAddGroupMembersOpen]     = useState(false)
  const [addGroupMembersTarget, setAddGroupMembersTarget] = useState(null)
  const [addGroupMemberUids, setAddGroupMemberUids]       = useState([])
  const [addingGroupMembers, setAddingGroupMembers]       = useState(false)
  const [removeGroupMemberTarget, setRemoveGroupMemberTarget] = useState(null)
  const [removingGroupMember, setRemovingGroupMember]         = useState(false)

  // settings / schedule
  const [editForm, setEditForm]           = useState(null)
  const [savingEdit, setSavingEdit]       = useState(false)
  const [planDataMap, setPlanDataMap]     = useState({})
  const [scheduleDraft, setScheduleDraft] = useState({})
  const [loadingPlanFor, setLoadingPlanFor]       = useState(null)
  const [savingScheduleFor, setSavingScheduleFor] = useState(null)

  // ── derived ─────────────────────────────────────────────────────────────────
  const templatePlans   = plans.filter((p) => p.is_template !== false)
  const internMap       = Object.fromEntries(interns.map((i) => [i.id, i]))
  const planMap         = Object.fromEntries(plans.map((p) => [p.id, p]))
  const selected        = cohorts.find((c) => c.id === selectedId) || null
  const selectedGroups  = selected ? (groupsMap[selected.id] || []) : []
  const filteredCohorts = filter === "all" ? cohorts : cohorts.filter((c) => c.type === filter)
  const allUids         = [...new Set(cohorts.flatMap((c) => c.member_uids || []))]
  const withProgress    = allUids.filter((uid) => progressMap[uid]?.overall_pct != null)
  const avgCompletion   = withProgress.length
    ? Math.round(withProgress.reduce((s, uid) => s + (progressMap[uid].overall_pct ?? 0), 0) / withProgress.length)
    : 0
  const isSolo          = selected?.type === "solo"
  const isBatch         = selected?.type === "program"
  const meta            = selected ? (TYPE_META[selected.type] || TYPE_META.solo) : null
  const availableToAdd  = interns.filter((i) => !(selected?.member_uids || []).includes(i.id))
  const cohortAvg       = (uids) => {
    if (!uids?.length) return null
    return Math.round(uids.reduce((s, uid) => s + (progressMap[uid]?.overall_pct ?? 0), 0) / uids.length)
  }
  const availableForGroup = (group) => interns.filter((i) => !(group.member_uids || []).includes(i.id))

  // ── effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, "cohorts"), (snap) => {
      setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, console.error))
    getDocs(collection(db, "plans")).then((snap) =>
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    getDocs(query(collection(db, "users"), where("role", "==", "intern"))).then((snap) =>
      setInterns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    unsubs.push(onSnapshot(collection(db, "progress"), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      setProgressMap(map)
    }, console.error))
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    if (!selected) return
    setEditForm({
      name: selected.name || "",
      type: selected.type || "solo",
      plan_id: selected.plan_id || "",
      start_date: selected.start_date
        ? (selected.start_date?.toDate ? selected.start_date.toDate() : new Date(selected.start_date))
            .toISOString().split("T")[0]
        : "",
    })
  }, [selectedId])

  // ── mutations ────────────────────────────────────────────────────────────────
  const loadCohortPlan = async (cohort) => {
    if (!cohort.plan_id || planDataMap[cohort.id]) return
    setLoadingPlanFor(cohort.id)
    try {
      const { tracks, modules } = await loadPlanStructure(cohort.plan_id)
      setPlanDataMap((p) => ({ ...p, [cohort.id]: { tracks, modules } }))
      const placements   = draftPlacementsFromCohort(cohort, modules, tracks)
      const scheduledEnd = lastScheduledWeek(placements)
      setScheduleDraft((p) => ({
        ...p,
        [cohort.id]: { duration_weeks: cohort.duration_weeks ?? (scheduledEnd || 8), module_placements: placements },
      }))
    } catch (err) { console.error(err) }
    finally { setLoadingPlanFor(null) }
  }

  const loadCohortGroups = async (cohort) => {
    if (cohort.type !== "program" || groupsMap[cohort.id]) return
    setLoadingGroups(true)
    try {
      const snap = await getDocs(query(collection(db, "groups"), where("cohort_id", "==", cohort.id)))
      setGroupsMap((p) => ({ ...p, [cohort.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }))
    } catch (err) { console.error(err) }
    finally { setLoadingGroups(false) }
  }

  const refreshGroups = async (cohortId) => {
    const snap = await getDocs(query(collection(db, "groups"), where("cohort_id", "==", cohortId)))
    setGroupsMap((p) => ({ ...p, [cohortId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }))
  }

  const handleSelectCohort = (cohort) => {
    setSelectedId(cohort.id)
    if (cohort.plan_id) loadCohortPlan(cohort)
    if (cohort.type === "program") loadCohortGroups(cohort)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const members = form.type === "solo"
        ? form.member_uids.slice(0, 1)
        : form.type === "program" ? [] : form.member_uids
      const ref = await addDoc(collection(db, "cohorts"), {
        name: form.name.trim(), type: form.type,
        plan_id: form.type !== "program" ? (form.plan_id || null) : null,
        start_date: form.start_date ? new Date(form.start_date) : null,
        member_uids: members, group_ids: [],
        created_by: user?.uid, created_at: serverTimestamp(),
      })
      await Promise.all(members.map((uid) => updateDoc(doc(db, "users", uid), { cohort_ids: arrayUnion(ref.id) })))
      setCreateOpen(false)
      setForm({ name: "", type: "solo", plan_id: "", start_date: "", member_uids: [] })
      handleSelectCohort({ id: ref.id, type: form.type, plan_id: form.plan_id })
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  const handleSaveEdit = async () => {
    if (!selected || !editForm?.name?.trim()) return
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, "cohorts", selected.id), {
        name: editForm.name.trim(), type: editForm.type,
        plan_id: editForm.plan_id || null,
        start_date: editForm.start_date ? new Date(editForm.start_date) : null,
      })
      if (editForm.plan_id !== selected.plan_id) {
        const next = { ...planDataMap }; delete next[selected.id]; setPlanDataMap(next)
        if (editForm.plan_id) loadCohortPlan({ ...selected, plan_id: editForm.plan_id })
      }
    } catch (err) { console.error(err) }
    finally { setSavingEdit(false) }
  }

  const handleAddMembers = async () => {
    if (!selected || !addMemberUids.length) return
    const uids = isSolo ? addMemberUids.slice(0, 1) : addMemberUids
    setAddingMembers(true)
    try {
      await updateDoc(doc(db, "cohorts", selected.id), { member_uids: arrayUnion(...uids) })
      await Promise.all(uids.map((uid) => updateDoc(doc(db, "users", uid), { cohort_ids: arrayUnion(selected.id) })))
      setAddMembersOpen(false); setAddMemberUids([])
    } catch (err) { console.error(err) }
    finally { setAddingMembers(false) }
  }

  const handleRemoveMember = async () => {
    if (!selected || !removeMemberTarget) return
    setRemovingMember(true)
    try {
      await updateDoc(doc(db, "cohorts", selected.id), { member_uids: arrayRemove(removeMemberTarget) })
      await updateDoc(doc(db, "users", removeMemberTarget), { cohort_ids: arrayRemove(selected.id) })
      setRemoveMemberTarget(null)
    } catch (err) { console.error(err) }
    finally { setRemovingMember(false) }
  }

  const handleCreateGroup = async () => {
    if (!selected || !newGroupForm.name.trim()) return
    setCreatingGroup(true)
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name: newGroupForm.name.trim(), cohort_id: selected.id,
        plan_id: newGroupForm.plan_id || null,
        member_uids: newGroupForm.member_uids,
        created_by: user?.uid,
      })
      await updateDoc(doc(db, "cohorts", selected.id), { group_ids: arrayUnion(ref.id) })
      await Promise.all(newGroupForm.member_uids.map((uid) =>
        updateDoc(doc(db, "users", uid), { cohort_ids: arrayUnion(selected.id), group_ids: arrayUnion(ref.id) })
      ))
      setNewGroupOpen(false)
      setNewGroupForm({ name: "", plan_id: "", member_uids: [] })
      await refreshGroups(selected.id)
    } catch (err) { console.error(err) }
    finally { setCreatingGroup(false) }
  }

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget || !selected) return
    setDeletingGroup(true)
    try {
      await Promise.all((deleteGroupTarget.member_uids || []).map((uid) =>
        updateDoc(doc(db, "users", uid), { group_ids: arrayRemove(deleteGroupTarget.id) })
      ))
      await updateDoc(doc(db, "cohorts", selected.id), { group_ids: arrayRemove(deleteGroupTarget.id) })
      await deleteDoc(doc(db, "groups", deleteGroupTarget.id))
      setDeleteGroupTarget(null)
      await refreshGroups(selected.id)
    } catch (err) { console.error(err) }
    finally { setDeletingGroup(false) }
  }

  const handleAddGroupMembers = async () => {
    if (!addGroupMembersTarget || !addGroupMemberUids.length) return
    setAddingGroupMembers(true)
    try {
      await updateDoc(doc(db, "groups", addGroupMembersTarget.id), { member_uids: arrayUnion(...addGroupMemberUids) })
      await Promise.all(addGroupMemberUids.map((uid) =>
        updateDoc(doc(db, "users", uid), { cohort_ids: arrayUnion(selected.id), group_ids: arrayUnion(addGroupMembersTarget.id) })
      ))
      setAddGroupMembersOpen(false); setAddGroupMembersTarget(null); setAddGroupMemberUids([])
      await refreshGroups(selected.id)
    } catch (err) { console.error(err) }
    finally { setAddingGroupMembers(false) }
  }

  const handleRemoveGroupMember = async () => {
    if (!removeGroupMemberTarget || !selected) return
    setRemovingGroupMember(true)
    try {
      const { groupId, uid } = removeGroupMemberTarget
      await updateDoc(doc(db, "groups", groupId), { member_uids: arrayRemove(uid) })
      await updateDoc(doc(db, "users", uid), { group_ids: arrayRemove(groupId) })
      setRemoveGroupMemberTarget(null)
      await refreshGroups(selected.id)
    } catch (err) { console.error(err) }
    finally { setRemovingGroupMember(false) }
  }

  const handleDeleteCohort = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await Promise.all((deleteTarget.member_uids || []).map((uid) =>
        updateDoc(doc(db, "users", uid), { cohort_ids: arrayRemove(deleteTarget.id) })
      ))
      await deleteDoc(doc(db, "cohorts", deleteTarget.id))
      setDeleteTarget(null)
      if (selectedId === deleteTarget.id) setSelectedId(null)
    } catch (err) { console.error(err) }
    finally { setDeleting(false) }
  }

  const handleSaveSchedule = async (cohort) => {
    const draft    = scheduleDraft[cohort.id]
    const planData = planDataMap[cohort.id]
    if (!draft || !planData) return
    setSavingScheduleFor(cohort.id)
    try {
      await updateDoc(doc(db, "cohorts", cohort.id), {
        duration_weeks: Number(draft.duration_weeks) || lastScheduledWeek(draft.module_placements),
        module_schedule: placementsToModuleSchedule(draft.module_placements),
      })
    } catch (err) { console.error(err) }
    finally { setSavingScheduleFor(null) }
  }

  // ── member row ───────────────────────────────────────────────────────────────
  const MemberRow = ({ uid, onRemove }) => {
    const intern = internMap[uid]
    const prog   = progressMap[uid]
    if (!intern) return null
    const initials = intern.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"
    return (
      <div className="flex items-center gap-3 py-2.5 group">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-muted font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{intern.name}</span>
            {intern.status && (
              <Badge variant="outline" className="text-xs capitalize shrink-0">{intern.status}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{intern.email}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-xs font-medium tabular-nums">
              {prog ? `${Math.round(prog.overall_pct ?? 0)}%` : "—"}
            </p>
          </div>
          {prog && <Progress value={prog.overall_pct ?? 0} className="h-1.5 w-20 hidden sm:block" />}
          {onRemove && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <UserMinus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── TYPE SELECTOR (shared between create + settings) ──────────────────────
  const TypeSelector = ({ value, onChange }) => (
    <div className="grid gap-2">
      {Object.entries(TYPE_META).map(([key, m]) => (
        <button
          key={key} type="button" onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
            value === key ? "border-foreground bg-foreground/5" : "border-border hover:bg-accent"
          )}
        >
          <m.icon className={cn("h-4 w-4 shrink-0", value === key ? "text-foreground" : "text-muted-foreground")} />
          <div>
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ═══════════════════════════════════════════════════════════════════════
          LIST VIEW
      ══════════════════════════════════════════════════════════════════════════ */}
      {!selected && (
        <>
          <div className="px-8 pt-8 pb-0">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Programs</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage your intern training programs, groups, and batches.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Program
              </Button>
            </div>

            {!loading && cohorts.length > 0 && (
              <div className="flex items-center gap-5 mb-5 text-sm">
                <span><span className="font-semibold">{cohorts.length}</span> <span className="text-muted-foreground">programs</span></span>
                <span className="text-border">·</span>
                <span><span className="font-semibold">{allUids.length}</span> <span className="text-muted-foreground">interns enrolled</span></span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{avgCompletion}%</span>
                  <span className="text-muted-foreground">avg completion</span>
                  <Progress value={avgCompletion} className="w-20 h-1.5" />
                </span>
              </div>
            )}

            <div className="flex border-b border-border">
              {[
                { key: "all",     label: "All",   count: cohorts.length },
                { key: "solo",    label: "Solo",  count: cohorts.filter((c) => c.type === "solo").length },
                { key: "group",   label: "Group", count: cohorts.filter((c) => c.type === "group").length },
                { key: "program", label: "Batch", count: cohorts.filter((c) => c.type === "program").length },
              ].map(({ key, label, count }) => (
                <button
                  key={key} onClick={() => setFilter(key)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    filter === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  <span className={cn("ml-1.5 text-xs tabular-nums", filter === key ? "" : "opacity-50")}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-5">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : filteredCohorts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Layers className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">{filter === "all" ? "No programs yet" : `No ${TYPE_META[filter]?.label} programs`}</p>
                {filter === "all" && (
                  <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New Program
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {filteredCohorts.map((cohort) => {
                  const cMeta      = TYPE_META[cohort.type] || TYPE_META.solo
                  const Icon       = cMeta.icon
                  const memberUids = cohort.member_uids || []
                  const avg        = cohortAvg(memberUids)
                  const plan       = planMap[cohort.plan_id]
                  return (
                    <button
                      key={cohort.id}
                      onClick={() => handleSelectCohort(cohort)}
                      className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{cohort.name}</span>
                          <Badge variant={cMeta.color} className="text-xs shrink-0">{cMeta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {plan
                            ? <><BookOpen className="h-3 w-3 inline mr-1" />{plan.name}</>
                            : cohort.type === "program"
                              ? `${(cohort.group_ids || []).length} group${(cohort.group_ids || []).length !== 1 ? "s" : ""}`
                              : "No plan assigned"
                          }
                        </p>
                      </div>
                      {cohort.type !== "program" && memberUids.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex -space-x-1.5">
                            {memberUids.slice(0, 3).map((uid) => (
                              <Avatar key={uid} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs bg-muted">
                                  {internMap[uid]?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {memberUids.length > 3 && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                                +{memberUids.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{memberUids.length}</span>
                        </div>
                      )}
                      {cohort.type !== "program" && avg !== null && (
                        <div className="flex items-center gap-2 w-28 shrink-0">
                          <Progress value={avg} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums w-7 text-right">{avg}%</span>
                        </div>
                      )}
                      {cohort.start_date && (
                        <span className="text-xs text-muted-foreground shrink-0 hidden lg:block w-28 text-right">
                          {formatDate(cohort.start_date)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DETAIL VIEW
      ══════════════════════════════════════════════════════════════════════════ */}
      {selected && meta && (
        <>
          <div className="px-8 py-5 border-b border-border shrink-0">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All Programs
            </button>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                  <meta.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold truncate">{selected.name}</h2>
                    <Badge variant={meta.color} className="capitalize text-xs">{meta.label}</Badge>
                    {planMap[selected.plan_id] && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <BookOpen className="h-3 w-3" />{planMap[selected.plan_id].name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBatch
                      ? `${(selected.group_ids || []).length} groups`
                      : `${(selected.member_uids || []).length} member${(selected.member_uids || []).length !== 1 ? "s" : ""}`
                    }
                    {!isBatch && cohortAvg(selected.member_uids) !== null && ` · ${cohortAvg(selected.member_uids)}% avg`}
                    {selected.start_date && ` · Started ${formatDate(selected.start_date)}`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline" size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => setDeleteTarget(selected)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>

          <Tabs defaultValue={isBatch ? "groups" : "members"} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-8 border-b border-border shrink-0">
              <TabsList className="h-10 bg-transparent p-0 rounded-none">
                {(isBatch
                  ? [{ value: "groups",   icon: FolderOpen,    label: "Groups" },
                     { value: "settings", icon: Settings,      label: "Settings" }]
                  : [{ value: "members",  icon: Users,         label: isSolo ? "Intern" : "Members" },
                     { value: "schedule", icon: CalendarDays,  label: "Schedule" },
                     { value: "settings", icon: Settings,      label: "Settings" }]
                ).map(({ value, icon: Icon, label }) => (
                  <TabsTrigger key={value} value={value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none bg-transparent px-4 gap-1.5 text-sm h-10"
                  >
                    <Icon className="h-3.5 w-3.5" />{label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Members tab */}
            {!isBatch && (
              <TabsContent value="members" className="flex-1 overflow-y-auto m-0">
                <div className="px-8 py-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold">{isSolo ? "Assigned Intern" : "Members"}</h3>
                      <p className="text-xs text-muted-foreground">
                        {isSolo ? "Solo programs are assigned to one intern." : `${(selected.member_uids || []).length} interns on the same plan`}
                      </p>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => { setAddMemberUids([]); setAddMembersOpen(true) }}
                      disabled={!availableToAdd.length}
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add Interns
                    </Button>
                  </div>

                  {!(selected.member_uids || []).length ? (
                    <div className="rounded-xl border border-dashed border-border flex flex-col items-center py-12 text-muted-foreground">
                      <User className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm">{isSolo ? "No intern assigned yet" : "No members yet"}</p>
                      <Button
                        size="sm" className="mt-3"
                        onClick={() => { setAddMemberUids([]); setAddMembersOpen(true) }}
                        disabled={!availableToAdd.length}
                      >
                        <UserPlus className="h-3.5 w-3.5" />{isSolo ? "Assign Intern" : "Add Interns"}
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl px-4">
                      {(selected.member_uids || []).map((uid) => (
                        <MemberRow key={uid} uid={uid} onRemove={() => setRemoveMemberTarget(uid)} />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Groups tab (batch) */}
            {isBatch && (
              <TabsContent value="groups" className="flex-1 overflow-y-auto m-0">
                <div className="px-8 py-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold">Groups</h3>
                      <p className="text-xs text-muted-foreground">Each group has its own plan and members.</p>
                    </div>
                    <Button size="sm" variant="outline"
                      onClick={() => { setNewGroupForm({ name: "", plan_id: "", member_uids: [] }); setNewGroupOpen(true) }}
                    >
                      <Plus className="h-3.5 w-3.5" /> New Group
                    </Button>
                  </div>

                  {loadingGroups ? (
                    <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : !selectedGroups.length ? (
                    <div className="rounded-xl border border-dashed border-border flex flex-col items-center py-12 text-muted-foreground">
                      <FolderOpen className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm">No groups yet</p>
                      <Button size="sm" className="mt-3"
                        onClick={() => { setNewGroupForm({ name: "", plan_id: "", member_uids: [] }); setNewGroupOpen(true) }}
                      >
                        <Plus className="h-3.5 w-3.5" /> New Group
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedGroups.map((group) => {
                        const gPlan = planMap[group.plan_id]
                        const gUids = group.member_uids || []
                        const gAvg  = cohortAvg(gUids)
                        const avail = availableForGroup(group)
                        return (
                          <Collapsible key={group.id}>
                            <div className="border border-border rounded-xl overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 [&[data-state=open]>svg]:rotate-90">
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform" />
                                  </Button>
                                </CollapsibleTrigger>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{group.name}</span>
                                    {gPlan && (
                                      <Badge variant="outline" className="text-xs gap-1 shrink-0">
                                        <BookOpen className="h-3 w-3" />{gPlan.name}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {gUids.length} member{gUids.length !== 1 ? "s" : ""}{gAvg !== null ? ` · ${gAvg}% avg` : ""}
                                  </p>
                                </div>
                                {gAvg !== null && <Progress value={gAvg} className="w-24 h-1.5 shrink-0" />}
                                <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground h-7 px-2"
                                  onClick={() => { setAddGroupMembersTarget(group); setAddGroupMemberUids([]); setAddGroupMembersOpen(true) }}
                                  disabled={!avail.length}
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteGroupTarget(group)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <CollapsibleContent>
                                <div className="border-t border-border px-4 divide-y divide-border">
                                  {!gUids.length
                                    ? <p className="py-3 text-xs text-muted-foreground">No members yet.</p>
                                    : gUids.map((uid) => (
                                        <MemberRow key={uid} uid={uid}
                                          onRemove={() => setRemoveGroupMemberTarget({ groupId: group.id, uid })}
                                        />
                                      ))
                                  }
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Schedule tab */}
            {!isBatch && (
              <TabsContent value="schedule" className="flex-1 overflow-y-auto m-0">
                <div className="px-8 py-6">
                  {!selected.plan_id ? (
                    <div className="rounded-xl border border-dashed border-border flex flex-col items-center py-16 text-muted-foreground">
                      <CalendarDays className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm">No plan assigned — go to Settings to add one.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold">Plan Schedule</h3>
                          <p className="text-xs text-muted-foreground">Drag modules onto the timeline to assign weeks.</p>
                        </div>
                        <Button size="sm" onClick={() => handleSaveSchedule(selected)}
                          disabled={!scheduleDraft[selected.id] || savingScheduleFor === selected.id}
                        >
                          <Save className="h-3.5 w-3.5" />{savingScheduleFor === selected.id ? "Saving…" : "Save Schedule"}
                        </Button>
                      </div>
                      {loadingPlanFor === selected.id ? (
                        <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-48 w-full" /></div>
                      ) : planDataMap[selected.id] ? (
                        <PlanScheduleCalendar
                          durationWeeks={scheduleDraft[selected.id]?.duration_weeks ?? 8}
                          onDurationChange={(n) => setScheduleDraft((p) => ({ ...p, [selected.id]: { ...p[selected.id], duration_weeks: n } }))}
                          startDate={selected.start_date}
                          tracks={planDataMap[selected.id].tracks}
                          modules={planDataMap[selected.id].modules}
                          placements={scheduleDraft[selected.id]?.module_placements ?? {}}
                          onPlacementsChange={(mp) => setScheduleDraft((p) => ({ ...p, [selected.id]: { ...p[selected.id], module_placements: mp } }))}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading plan…</p>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Settings tab */}
            <TabsContent value="settings" className="flex-1 overflow-y-auto m-0">
              <div className="px-8 py-6 max-w-sm">
                {editForm && (
                  <div className="space-y-5">
                    <h3 className="text-sm font-semibold">Settings</h3>
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <TypeSelector value={editForm.type} onChange={(v) => setEditForm((f) => ({ ...f, type: v }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    {editForm.type !== "program" && (
                      <div className="space-y-1.5">
                        <Label>Plan Template</Label>
                        <Select value={editForm.plan_id || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, plan_id: v === "none" ? "" : v }))}>
                          <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No template</SelectItem>
                            {templatePlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button onClick={handleSaveEdit} disabled={!editForm.name.trim() || savingEdit}>
                      <Save className="h-3.5 w-3.5" />{savingEdit ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOGS
      ══════════════════════════════════════════════════════════════════════════ */}

      {/* Create program */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Program</DialogTitle>
            <DialogDescription>Create a new training program for your interns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Summer Cohort 2025"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <TypeSelector value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v, member_uids: [] }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            {form.type !== "program" && (
              <div className="space-y-1.5">
                <Label>Plan Template</Label>
                <Select value={form.plan_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {templatePlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || creating}>
              {creating ? "Creating…" : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add members to cohort — Intern Queue style */}
      <InternPickerDialog
        open={addMembersOpen}
        onOpenChange={setAddMembersOpen}
        available={availableToAdd}
        selected={addMemberUids}
        onToggle={(uid) => setAddMemberUids((p) => p.includes(uid) ? p.filter((id) => id !== uid) : [...p, uid])}
        maxOne={isSolo}
        title={isSolo ? "Assign Intern" : "Add Interns"}
        onConfirm={handleAddMembers}
        loading={addingMembers}
      />

      {/* New group */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
            <DialogDescription>Add a group with its own plan and members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input placeholder="e.g. Frontend Track" value={newGroupForm.name}
                onChange={(e) => setNewGroupForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan Template</Label>
              <Select value={newGroupForm.plan_id || "none"}
                onValueChange={(v) => setNewGroupForm((f) => ({ ...f, plan_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templatePlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupForm.name.trim() || creatingGroup}>
              {creatingGroup ? "Creating…" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add members to group — Intern Queue style */}
      <InternPickerDialog
        open={addGroupMembersOpen}
        onOpenChange={setAddGroupMembersOpen}
        available={addGroupMembersTarget ? availableForGroup(addGroupMembersTarget) : []}
        selected={addGroupMemberUids}
        onToggle={(uid) => setAddGroupMemberUids((p) => p.includes(uid) ? p.filter((id) => id !== uid) : [...p, uid])}
        title={`Add Interns to ${addGroupMembersTarget?.name || "Group"}`}
        onConfirm={handleAddGroupMembers}
        loading={addingGroupMembers}
      />

      {/* Remove from cohort */}
      <AlertDialog open={!!removeMemberTarget} onOpenChange={(o) => !o && setRemoveMemberTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove intern?</AlertDialogTitle>
            <AlertDialogDescription>
              {internMap[removeMemberTarget]?.name} will be removed from this program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={removingMember}>
              {removingMember ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove from group */}
      <AlertDialog open={!!removeGroupMemberTarget} onOpenChange={(o) => !o && setRemoveGroupMemberTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from group?</AlertDialogTitle>
            <AlertDialogDescription>
              {internMap[removeGroupMemberTarget?.uid]?.name} will be removed from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveGroupMember} disabled={removingGroupMember}>
              {removingGroupMember ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete group */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(o) => !o && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteGroupTarget?.name}" and its members will be removed from this batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} disabled={deletingGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingGroup ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete cohort */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete program?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCohort} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
