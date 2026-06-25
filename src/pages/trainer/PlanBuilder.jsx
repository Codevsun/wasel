import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, doc, updateDoc, getDocs,
  query, where, serverTimestamp, deleteDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Textarea } from "../../components/ui/textarea"
import { Skeleton } from "../../components/ui/skeleton"
import { Separator } from "../../components/ui/separator"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import {
  BookOpen, Plus, ChevronDown, ChevronRight, Copy, Layers,
  Calendar, FileText, FlaskConical, HelpCircle, Upload,
  Pencil, Trash2, Save, ArrowLeft,
} from "lucide-react"
import { cn } from "../../lib/utils"

const CATEGORY_OPTIONS = [
  { value: "frontend",  label: "Frontend" },
  { value: "backend",   label: "Backend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "devops",    label: "DevOps" },
  { value: "git",       label: "Git & GitHub" },
  { value: "ai",        label: "AI / ML" },
  { value: "cloud",     label: "Cloud" },
  { value: "security",  label: "Security" },
]

const TASK_TYPES = [
  { value: "reading",    label: "Reading",    icon: FileText },
  { value: "lab",        label: "Lab",        icon: FlaskConical },
  { value: "quiz",       label: "Quiz",       icon: HelpCircle },
  { value: "submission", label: "Submission", icon: Upload },
]

function TaskTypeIcon({ type, className }) {
  const opt = TASK_TYPES.find((t) => t.value === type)
  const Icon = opt?.icon || FileText
  return <Icon className={cn("h-3.5 w-3.5", className)} />
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function sortBy(arr, key) {
  return [...arr].sort((a, b) => (a[key] || 0) - (b[key] || 0))
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlanBuilder() {
  const { user } = useAuth()

  const [plans, setPlans]   = useState([])
  const [loading, setLoading] = useState(true)

  // selected plan (master → detail)
  const [selectedPlanId, setSelectedPlanId] = useState(null)

  // nested data
  const [tracksMap, setTracksMap]         = useState({})
  const [modulesMap, setModulesMap]       = useState({})
  const [milestonesMap, setMilestonesMap] = useState({})
  const [tasksMap, setTasksMap]           = useState({})
  const [loadingPlan, setLoadingPlan]     = useState(false)

  // tree expand state
  const [expandedTracks, setExpandedTracks]     = useState({})
  const [expandedModules, setExpandedModules]   = useState({})
  const [expandedMilestones, setExpandedMilestones] = useState({})

  // selected item in the detail panel
  // { kind: "plan"|"track"|"module"|"milestone"|"task", item: obj }
  const [selected, setSelected] = useState(null)

  // inline editing state (right panel)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)

  // create dialogs
  const [createDialog, setCreateDialog] = useState(null) // { kind, parentId }
  const [createForm, setCreateForm]     = useState({})
  const [creating, setCreating]         = useState(false)

  // plan-level dialogs
  const [planDialog, setPlanDialog]   = useState(false)
  const [planForm, setPlanForm]       = useState({ name: "" })
  const [editingPlan, setEditingPlan] = useState(null)
  const [savingPlan, setSavingPlan]   = useState(false)

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // ── data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "plans"), (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, console.error)
    return unsub
  }, [])

  const loadPlanData = async (planId) => {
    if (tracksMap[planId]) return
    setLoadingPlan(true)
    try {
      const tSnap  = await getDocs(query(collection(db, "tracks"), where("plan_id", "==", planId)))
      const tracks = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setTracksMap((p) => ({ ...p, [planId]: tracks }))

      await Promise.all(tracks.map(async (track) => {
        const mSnap   = await getDocs(query(collection(db, "modules"), where("track_id", "==", track.id)))
        const modules = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setModulesMap((p) => ({ ...p, [track.id]: modules }))

        await Promise.all(modules.map(async (mod) => {
          const msSnap     = await getDocs(query(collection(db, "milestones"), where("module_id", "==", mod.id)))
          const milestones = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          setMilestonesMap((p) => ({ ...p, [mod.id]: milestones }))

          await Promise.all(milestones.map(async (ms) => {
            const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", ms.id)))
            setTasksMap((p) => ({ ...p, [ms.id]: tskSnap.docs.map((d) => ({ id: d.id, ...d.data() })) }))
          }))
        }))
      }))
    } catch (err) { console.error(err) }
    finally { setLoadingPlan(false) }
  }

  const selectPlan = (plan) => {
    setSelectedPlanId(plan.id)
    setSelected({ kind: "plan", item: plan })
    setEditForm({ name: plan.name })
    setDirty(false)
    loadPlanData(plan.id)
    // auto-expand all tracks
    setExpandedTracks({})
    setExpandedModules({})
    setExpandedMilestones({})
  }

  const selectItem = (kind, item) => {
    setSelected({ kind, item })
    setDirty(false)
    if (kind === "track")     setEditForm({ label: item.label, category: item.category || "frontend" })
    if (kind === "module")    setEditForm({ title: item.title })
    if (kind === "milestone") setEditForm({ title: item.title, week_number: item.week_number || 1 })
    if (kind === "task")      setEditForm({ title: item.title, type: item.type || "reading", content: item.content || "" })
  }

  // ── mutations ─────────────────────────────────────────────────────────────
  const handleSaveSelected = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const { kind, item } = selected
      if (kind === "track") {
        await updateDoc(doc(db, "tracks", item.id), { label: editForm.label?.trim(), category: editForm.category })
        setTracksMap((p) => ({ ...p, [item.plan_id]: (p[item.plan_id] || []).map((t) => t.id === item.id ? { ...t, label: editForm.label?.trim(), category: editForm.category } : t) }))
        setSelected((s) => ({ ...s, item: { ...s.item, label: editForm.label?.trim(), category: editForm.category } }))
      } else if (kind === "module") {
        await updateDoc(doc(db, "modules", item.id), { title: editForm.title?.trim() })
        setModulesMap((p) => ({ ...p, [item.track_id]: (p[item.track_id] || []).map((m) => m.id === item.id ? { ...m, title: editForm.title?.trim() } : m) }))
        setSelected((s) => ({ ...s, item: { ...s.item, title: editForm.title?.trim() } }))
      } else if (kind === "milestone") {
        await updateDoc(doc(db, "milestones", item.id), { title: editForm.title?.trim(), week_number: Number(editForm.week_number) })
        setMilestonesMap((p) => ({ ...p, [item.module_id]: (p[item.module_id] || []).map((ms) => ms.id === item.id ? { ...ms, title: editForm.title?.trim(), week_number: Number(editForm.week_number) } : ms) }))
        setSelected((s) => ({ ...s, item: { ...s.item, title: editForm.title?.trim(), week_number: Number(editForm.week_number) } }))
      } else if (kind === "task") {
        await updateDoc(doc(db, "tasks", item.id), { title: editForm.title?.trim(), type: editForm.type, content: editForm.content?.trim() })
        setTasksMap((p) => ({ ...p, [item.milestone_id]: (p[item.milestone_id] || []).map((t) => t.id === item.id ? { ...t, title: editForm.title?.trim(), type: editForm.type, content: editForm.content?.trim() } : t) }))
        setSelected((s) => ({ ...s, item: { ...s.item, title: editForm.title?.trim(), type: editForm.type, content: editForm.content?.trim() } }))
      }
      setDirty(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) return
    setSavingPlan(true)
    try {
      if (editingPlan) {
        await updateDoc(doc(db, "plans", editingPlan.id), { name: planForm.name.trim(), is_template: true })
      } else {
        const ref = await addDoc(collection(db, "plans"), {
          name: planForm.name.trim(), is_template: true, track_ids: [],
          created_by: user?.uid, created_at: serverTimestamp(),
        })
        // auto-select the new plan
        const newPlan = { id: ref.id, name: planForm.name.trim(), is_template: true, track_ids: [] }
        selectPlan(newPlan)
      }
      setPlanDialog(false); setEditingPlan(null); setPlanForm({ name: "" })
    } catch (err) { console.error(err) }
    finally { setSavingPlan(false) }
  }

  const handleCreate = async () => {
    if (!createDialog) return
    setCreating(true)
    const { kind, parentId } = createDialog
    try {
      if (kind === "track") {
        const ref = await addDoc(collection(db, "tracks"), {
          label: createForm.label?.trim(), category: createForm.category || "frontend",
          plan_id: parentId, order: 0,
        })
        const newTrack = { id: ref.id, label: createForm.label?.trim(), category: createForm.category || "frontend", plan_id: parentId, order: 0 }
        setTracksMap((p) => ({ ...p, [parentId]: [...(p[parentId] || []), newTrack] }))
        setExpandedTracks((p) => ({ ...p, [ref.id]: true }))
        selectItem("track", newTrack)
      } else if (kind === "module") {
        const ref = await addDoc(collection(db, "modules"), { title: createForm.title?.trim(), track_id: parentId, order: 0 })
        const newMod = { id: ref.id, title: createForm.title?.trim(), track_id: parentId, order: 0 }
        setModulesMap((p) => ({ ...p, [parentId]: [...(p[parentId] || []), newMod] }))
        setExpandedModules((p) => ({ ...p, [ref.id]: true }))
        selectItem("module", newMod)
      } else if (kind === "milestone") {
        const ref = await addDoc(collection(db, "milestones"), {
          title: createForm.title?.trim(), week_number: Number(createForm.week_number) || 1, module_id: parentId,
        })
        const newMs = { id: ref.id, title: createForm.title?.trim(), week_number: Number(createForm.week_number) || 1, module_id: parentId }
        setMilestonesMap((p) => ({ ...p, [parentId]: [...(p[parentId] || []), newMs] }))
        setExpandedMilestones((p) => ({ ...p, [ref.id]: true }))
        selectItem("milestone", newMs)
      } else if (kind === "task") {
        const ref = await addDoc(collection(db, "tasks"), {
          title: createForm.title?.trim(), type: createForm.type || "reading",
          content: createForm.content?.trim() || "", milestone_id: parentId, order: 0,
        })
        const newTask = { id: ref.id, title: createForm.title?.trim(), type: createForm.type || "reading", content: createForm.content?.trim() || "", milestone_id: parentId, order: 0 }
        setTasksMap((p) => ({ ...p, [parentId]: [...(p[parentId] || []), newTask] }))
        selectItem("task", newTask)
      }
      setCreateDialog(null); setCreateForm({})
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { kind, item } = deleteTarget
    try {
      if (kind === "plan") {
        const tSnap = await getDocs(query(collection(db, "tracks"), where("plan_id", "==", item.id)))
        const trackIds = tSnap.docs.map((d) => d.id)
        const moduleIds = []
        for (const tid of trackIds) {
          const mSnap = await getDocs(query(collection(db, "modules"), where("track_id", "==", tid)))
          mSnap.docs.forEach((d) => moduleIds.push(d.id))
          await deleteDoc(doc(db, "tracks", tid))
        }
        const milestoneIds = []
        for (const mid of moduleIds) {
          const msSnap = await getDocs(query(collection(db, "milestones"), where("module_id", "==", mid)))
          msSnap.docs.forEach((d) => milestoneIds.push(d.id))
          await deleteDoc(doc(db, "modules", mid))
        }
        for (const msid of milestoneIds) {
          const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", msid)))
          await Promise.all(tskSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))
          await deleteDoc(doc(db, "milestones", msid))
        }
        await deleteDoc(doc(db, "plans", item.id))
        if (selectedPlanId === item.id) { setSelectedPlanId(null); setSelected(null) }
      } else if (kind === "track") {
        const mSnap = await getDocs(query(collection(db, "modules"), where("track_id", "==", item.id)))
        const moduleIds = mSnap.docs.map((d) => d.id)
        const milestoneIds = []
        for (const mid of moduleIds) {
          const msSnap = await getDocs(query(collection(db, "milestones"), where("module_id", "==", mid)))
          msSnap.docs.forEach((d) => milestoneIds.push(d.id))
          await deleteDoc(doc(db, "modules", mid))
        }
        for (const msid of milestoneIds) {
          const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", msid)))
          await Promise.all(tskSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))
          await deleteDoc(doc(db, "milestones", msid))
        }
        await deleteDoc(doc(db, "tracks", item.id))
        setTracksMap((p) => ({ ...p, [item.plan_id]: (p[item.plan_id] || []).filter((t) => t.id !== item.id) }))
        if (selected?.item?.id === item.id) setSelected(null)
      } else if (kind === "module") {
        const msSnap = await getDocs(query(collection(db, "milestones"), where("module_id", "==", item.id)))
        const milestoneIds = msSnap.docs.map((d) => d.id)
        for (const msid of milestoneIds) {
          const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", msid)))
          await Promise.all(tskSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))
          await deleteDoc(doc(db, "milestones", msid))
        }
        await deleteDoc(doc(db, "modules", item.id))
        setModulesMap((p) => ({ ...p, [item.track_id]: (p[item.track_id] || []).filter((m) => m.id !== item.id) }))
        if (selected?.item?.id === item.id) setSelected(null)
      } else if (kind === "milestone") {
        const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", item.id)))
        await Promise.all(tskSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))
        await deleteDoc(doc(db, "milestones", item.id))
        setMilestonesMap((p) => ({ ...p, [item.module_id]: (p[item.module_id] || []).filter((ms) => ms.id !== item.id) }))
        if (selected?.item?.id === item.id) setSelected(null)
      } else if (kind === "task") {
        await deleteDoc(doc(db, "tasks", item.id))
        setTasksMap((p) => ({ ...p, [item.milestone_id]: (p[item.milestone_id] || []).filter((t) => t.id !== item.id) }))
        if (selected?.item?.id === item.id) setSelected(null)
      }
      setDeleteTarget(null)
    } catch (err) { console.error(err) }
    finally { setDeleting(false) }
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null
  const planTracks   = selectedPlanId ? (tracksMap[selectedPlanId] || []) : []

  // ── RENDER ────────────────────────────────────────────────────────────────

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!selectedPlanId) return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plan Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Build reusable curriculum templates. Assign to programs when enrolling interns.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => { setEditingPlan(null); setPlanForm({ name: "" }); setPlanDialog(true) }}>
              <Plus className="h-4 w-4" /> New Plan
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 pt-5">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No templates yet</p>
            <Button size="sm" className="mt-4" onClick={() => { setEditingPlan(null); setPlanForm({ name: "" }); setPlanDialog(true) }}>
              <Plus className="h-3.5 w-3.5" /> Create your first template
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {plans.map((plan) => (
              <button key={plan.id} onClick={() => selectPlan(plan)}
                className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{plan.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">Template</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(plan.track_ids || []).length} track{(plan.track_ids || []).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditingPlan(plan); setPlanForm({ name: plan.name }); setPlanDialog(true) }}
                  ><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget({ kind: "plan", item: plan })}
                  ><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Plan create/edit dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Git & GitHub Fundamentals" value={planForm.name}
              onChange={(e) => setPlanForm({ name: e.target.value })} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSavePlan} disabled={!planForm.name.trim() || savingPlan}>
              {savingPlan ? "Saving…" : editingPlan ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.item?.name}" will be permanently deleted along with all its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  // ── DETAIL VIEW — split layout ────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: Plan tree ───────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Plan header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => { setSelectedPlanId(null); setSelected(null) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> All Templates
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold truncate flex-1">{selectedPlan?.name}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              onClick={() => { setEditingPlan(selectedPlan); setPlanForm({ name: selectedPlan?.name || "" }); setPlanDialog(true) }}
            ><Pencil className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2">
          {loadingPlan ? (
            <div className="space-y-1.5 px-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 rounded-md" />)}
            </div>
          ) : planTracks.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No tracks yet.
              <button className="block mx-auto mt-2 text-foreground underline underline-offset-2"
                onClick={() => { setCreateForm({ label: "", category: "frontend" }); setCreateDialog({ kind: "track", parentId: selectedPlanId }) }}
              >+ Add Track</button>
            </div>
          ) : (
            <div className="space-y-0.5 px-2">
              {sortBy(planTracks, "order").map((track) => {
                const trackOpen   = expandedTracks[track.id] !== false // default open
                const modules     = sortBy(modulesMap[track.id] || [], "order")
                return (
                  <div key={track.id}>
                    {/* Track row */}
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group",
                      selected?.item?.id === track.id ? "bg-accent text-foreground" : "hover:bg-accent/50"
                    )}>
                      <button className="shrink-0 text-muted-foreground"
                        onClick={() => setExpandedTracks((p) => ({ ...p, [track.id]: !trackOpen }))}
                      >
                        {trackOpen
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <button className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                        onClick={() => selectItem("track", track)}
                      >
                        <Badge variant="outline" className="text-xs capitalize shrink-0 px-1 py-0">{track.category?.slice(0, 3)}</Badge>
                        <span className="text-xs font-semibold truncate">{track.label}</span>
                      </button>
                      <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: "track", item: track }) }}
                      ><Trash2 className="h-3 w-3" /></button>
                    </div>

                    {/* Modules */}
                    {trackOpen && (
                      <div className="ml-4">
                        {modules.map((mod) => {
                          const modOpen    = expandedModules[mod.id] !== false
                          const milestones = sortBy(milestonesMap[mod.id] || [], "week_number")
                          return (
                            <div key={mod.id}>
                              {/* Module row */}
                              <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group",
                                selected?.item?.id === mod.id ? "bg-accent text-foreground" : "hover:bg-accent/50"
                              )}>
                                <button className="shrink-0 text-muted-foreground"
                                  onClick={() => setExpandedModules((p) => ({ ...p, [mod.id]: !modOpen }))}
                                >
                                  {modOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                                <button className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                                  onClick={() => selectItem("module", mod)}
                                >
                                  <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs font-medium truncate">{mod.title}</span>
                                </button>
                                <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: "module", item: mod }) }}
                                ><Trash2 className="h-3 w-3" /></button>
                              </div>

                              {/* Milestones */}
                              {modOpen && (
                                <div className="ml-4">
                                  {milestones.map((ms) => {
                                    const msOpen = expandedMilestones[ms.id] !== false
                                    const tasks  = sortBy(tasksMap[ms.id] || [], "order")
                                    return (
                                      <div key={ms.id}>
                                        {/* Milestone row */}
                                        <div className={cn(
                                          "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group",
                                          selected?.item?.id === ms.id ? "bg-accent text-foreground" : "hover:bg-accent/50"
                                        )}>
                                          <button className="shrink-0 text-muted-foreground"
                                            onClick={() => setExpandedMilestones((p) => ({ ...p, [ms.id]: !msOpen }))}
                                          >
                                            {msOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          </button>
                                          <button className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                                            onClick={() => selectItem("milestone", ms)}
                                          >
                                            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="text-xs truncate">
                                              <span className="font-semibold">W{ms.week_number}</span> · {ms.title}
                                            </span>
                                          </button>
                                          <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: "milestone", item: ms }) }}
                                          ><Trash2 className="h-3 w-3" /></button>
                                        </div>

                                        {/* Tasks */}
                                        {msOpen && (
                                          <div className="ml-4">
                                            {tasks.map((task) => (
                                              <div key={task.id} className={cn(
                                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group",
                                                selected?.item?.id === task.id ? "bg-accent text-foreground" : "hover:bg-accent/50"
                                              )}>
                                                <button className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                                                  onClick={() => selectItem("task", task)}
                                                >
                                                  <TaskTypeIcon type={task.type} className="text-muted-foreground shrink-0" />
                                                  <span className="text-xs truncate">{task.title}</span>
                                                </button>
                                                <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: "task", item: task }) }}
                                                ><Trash2 className="h-3 w-3" /></button>
                                              </div>
                                            ))}
                                            <button
                                              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground w-full text-left"
                                              onClick={() => { setCreateForm({ title: "", type: "reading", content: "" }); setCreateDialog({ kind: "task", parentId: ms.id }) }}
                                            >
                                              <Plus className="h-3 w-3" /> Add task
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  <button
                                    className="flex items-center gap-1 ml-4 px-2 py-1 text-xs text-muted-foreground hover:text-foreground w-full text-left"
                                    onClick={() => { setCreateForm({ title: "", week_number: 1 }); setCreateDialog({ kind: "milestone", parentId: mod.id }) }}
                                  >
                                    <Plus className="h-3 w-3" /> Add week
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <button
                          className="flex items-center gap-1 ml-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground w-full text-left"
                          onClick={() => { setCreateForm({ title: "" }); setCreateDialog({ kind: "module", parentId: track.id }) }}
                        >
                          <Plus className="h-3 w-3" /> Add module
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              <button
                className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground mt-1"
                onClick={() => { setCreateForm({ label: "", category: "frontend" }); setCreateDialog({ kind: "track", parentId: selectedPlanId }) }}
              >
                <Plus className="h-3 w-3" /> Add track
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Content panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">Select an item from the tree to view or edit it</p>
          </div>
        ) : (
          <>
            {/* Content header */}
            <div className="px-8 py-5 border-b border-border shrink-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {selected.kind === "track"     && <Badge variant="outline" className="capitalize shrink-0">{selected.item.category}</Badge>}
                {selected.kind === "module"    && <Layers className="h-4 w-4 text-muted-foreground shrink-0" />}
                {selected.kind === "milestone" && <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />}
                {selected.kind === "task"      && <TaskTypeIcon type={selected.item.type} className="text-muted-foreground" />}
                <h2 className="text-lg font-bold truncate">
                  {selected.kind === "track"     ? selected.item.label
                  : selected.kind === "milestone" ? `Week ${selected.item.week_number} · ${selected.item.title}`
                  : selected.item.title}
                </h2>
                {selected.kind === "task" && (
                  <Badge variant="outline" className="capitalize text-xs shrink-0">{selected.item.type}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {dirty && (
                  <Button size="sm" onClick={handleSaveSelected} disabled={saving}>
                    <Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget({ kind: selected.kind, item: selected.item })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {/* TRACK edit */}
              {selected.kind === "track" && (
                <div className="max-w-lg space-y-5">
                  <div className="space-y-1.5">
                    <Label>Track Name</Label>
                    <Input value={editForm.label || ""}
                      onChange={(e) => { setEditForm((f) => ({ ...f, label: e.target.value })); setDirty(true) }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={editForm.category || "frontend"}
                      onValueChange={(v) => { setEditForm((f) => ({ ...f, category: v })); setDirty(true) }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Modules in this track</h3>
                      <Button size="sm" variant="outline"
                        onClick={() => { setCreateForm({ title: "" }); setCreateDialog({ kind: "module", parentId: selected.item.id }) }}
                      ><Plus className="h-3.5 w-3.5" /> Add Module</Button>
                    </div>
                    {(modulesMap[selected.item.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No modules yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {sortBy(modulesMap[selected.item.id] || [], "order").map((mod) => (
                          <button key={mod.id} onClick={() => selectItem("module", mod)}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm"
                          >
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />{mod.title}
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MODULE edit */}
              {selected.kind === "module" && (
                <div className="max-w-lg space-y-5">
                  <div className="space-y-1.5">
                    <Label>Module Title</Label>
                    <Input value={editForm.title || ""}
                      onChange={(e) => { setEditForm((f) => ({ ...f, title: e.target.value })); setDirty(true) }} />
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Weeks in this module</h3>
                      <Button size="sm" variant="outline"
                        onClick={() => { setCreateForm({ title: "", week_number: 1 }); setCreateDialog({ kind: "milestone", parentId: selected.item.id }) }}
                      ><Plus className="h-3.5 w-3.5" /> Add Week</Button>
                    </div>
                    {(milestonesMap[selected.item.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No weeks yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {sortBy(milestonesMap[selected.item.id] || [], "week_number").map((ms) => (
                          <button key={ms.id} onClick={() => selectItem("milestone", ms)}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm"
                          >
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span><span className="font-semibold">Week {ms.week_number}</span> · {ms.title}</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MILESTONE edit */}
              {selected.kind === "milestone" && (
                <div className="max-w-lg space-y-5">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-1">
                      <Label>Week #</Label>
                      <Input type="number" min={1} value={editForm.week_number || 1}
                        onChange={(e) => { setEditForm((f) => ({ ...f, week_number: e.target.value })); setDirty(true) }} />
                    </div>
                    <div className="space-y-1.5 col-span-3">
                      <Label>Title</Label>
                      <Input value={editForm.title || ""}
                        onChange={(e) => { setEditForm((f) => ({ ...f, title: e.target.value })); setDirty(true) }} />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Tasks this week</h3>
                      <Button size="sm" variant="outline"
                        onClick={() => { setCreateForm({ title: "", type: "reading", content: "" }); setCreateDialog({ kind: "task", parentId: selected.item.id }) }}
                      ><Plus className="h-3.5 w-3.5" /> Add Task</Button>
                    </div>
                    {(tasksMap[selected.item.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tasks yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {sortBy(tasksMap[selected.item.id] || [], "order").map((task) => (
                          <button key={task.id} onClick={() => selectItem("task", task)}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm"
                          >
                            <TaskTypeIcon type={task.type} className="text-muted-foreground" />
                            <span className="flex-1 truncate">{task.title}</span>
                            <Badge variant="outline" className="text-xs capitalize shrink-0">{task.type}</Badge>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TASK edit — the main one: title + type + full content */}
              {selected.kind === "task" && (
                <div className="max-w-2xl space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Title</Label>
                      <Input value={editForm.title || ""}
                        onChange={(e) => { setEditForm((f) => ({ ...f, title: e.target.value })); setDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={editForm.type || "reading"}
                        onValueChange={(v) => { setEditForm((f) => ({ ...f, type: v })); setDirty(true) }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TASK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content / Instructions</Label>
                    <Textarea
                      placeholder="Write the task content, description, links, or instructions here…"
                      value={editForm.content || ""}
                      onChange={(e) => { setEditForm((f) => ({ ...f, content: e.target.value })); setDirty(true) }}
                      rows={16}
                      className="resize-y font-mono text-sm leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── CREATE DIALOGS ─────────────────────────────────────────────────── */}

      <Dialog open={!!createDialog} onOpenChange={(o) => !o && setCreateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createDialog?.kind === "track"     ? "Add Track"
              : createDialog?.kind === "module"   ? "Add Module"
              : createDialog?.kind === "milestone" ? "Add Week"
              : "Add Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createDialog?.kind === "track" && (
              <>
                <div className="space-y-1.5">
                  <Label>Label <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Git Fundamentals" value={createForm.label || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={createForm.category || "frontend"}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {(createDialog?.kind === "module") && (
              <div className="space-y-1.5">
                <Label>Module Title <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Git Fundamentals" value={createForm.title || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
            )}
            {createDialog?.kind === "milestone" && (
              <>
                <div className="space-y-1.5">
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Version Control Basics" value={createForm.title || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Week Number</Label>
                  <Input type="number" min={1} value={createForm.week_number || 1}
                    onChange={(e) => setCreateForm((f) => ({ ...f, week_number: e.target.value }))} />
                </div>
              </>
            )}
            {createDialog?.kind === "task" && (
              <>
                <div className="space-y-1.5">
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Read: What is Version Control?" value={createForm.title || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={createForm.type || "reading"}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Content</Label>
                  <Textarea placeholder="Instructions, links, description…" value={createForm.content || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))} rows={4} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || (
                createDialog?.kind === "track" ? !createForm.label?.trim()
                : !createForm.title?.trim()
              )}
            >
              {creating ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan edit dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Template Name</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name</Label>
            <Input value={planForm.name} onChange={(e) => setPlanForm({ name: e.target.value })} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSavePlan} disabled={!planForm.name.trim() || savingPlan}>
              {savingPlan ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.kind === "milestone" ? "week" : deleteTarget?.kind}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.item?.name || deleteTarget?.item?.label || deleteTarget?.item?.title}" will be permanently deleted
              {["track", "module", "milestone"].includes(deleteTarget?.kind) ? " along with all nested content" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
