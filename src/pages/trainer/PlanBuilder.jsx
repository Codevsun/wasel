import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, doc, updateDoc, getDocs,
  query, where, serverTimestamp, deleteDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Badge } from "../../components/ui/badge"
import { Separator } from "../../components/ui/separator"
import { Textarea } from "../../components/ui/textarea"
import { Switch } from "../../components/ui/switch"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  BookOpen, Plus, ChevronDown, ChevronRight, Copy, Layers,
  Calendar, FileText, FlaskConical, HelpCircle, Upload,
  Pencil, Trash2,
} from "lucide-react"
import { cn } from "../../lib/utils"

const CATEGORY_OPTIONS = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "devops", label: "DevOps" },
  { value: "git", label: "Git & GitHub" },
  { value: "ai", label: "AI / ML" },
  { value: "cloud", label: "Cloud" },
  { value: "security", label: "Security" },
]

const TASK_TYPE_OPTIONS = [
  { value: "reading", label: "Reading", icon: FileText },
  { value: "lab", label: "Lab", icon: FlaskConical },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
  { value: "submission", label: "Submission", icon: Upload },
]

function TaskTypeIcon({ type, className }) {
  const opt = TASK_TYPE_OPTIONS.find((t) => t.value === type)
  const Icon = opt?.icon || FileText
  return <Icon className={cn("h-3.5 w-3.5", className)} />
}

export default function PlanBuilder() {
  const { user } = useAuth()

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPlan, setExpandedPlan] = useState(null)

  // Nested data keyed by plan_id
  const [tracksMap, setTracksMap] = useState({})       // plan_id -> track[]
  const [modulesMap, setModulesMap] = useState({})     // track_id -> module[]
  const [milestonesMap, setMilestonesMap] = useState({}) // module_id -> milestone[]
  const [tasksMap, setTasksMap] = useState({})         // milestone_id -> task[]

  // Create plan dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [planForm, setPlanForm] = useState({ name: "", duration_weeks: 8, is_template: false })
  const [savingPlan, setSavingPlan] = useState(false)

  // Add track dialog
  const [trackDialog, setTrackDialog] = useState({ open: false, plan_id: null })
  const [trackForm, setTrackForm] = useState({ label: "", category: "frontend", order: 0 })

  // Add module dialog
  const [moduleDialog, setModuleDialog] = useState({ open: false, track_id: null })
  const [moduleForm, setModuleForm] = useState({ title: "", order: 0 })

  // Add milestone dialog
  const [milestoneDialog, setMilestoneDialog] = useState({ open: false, module_id: null })
  const [milestoneForm, setMilestoneForm] = useState({ title: "", week_number: 1 })

  // Add task dialog
  const [taskDialog, setTaskDialog] = useState({ open: false, milestone_id: null })
  const [taskForm, setTaskForm] = useState({ title: "", type: "reading", content: "", order: 0 })

  const [saving, setSaving] = useState(false)

  // Delete plan
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "plans"), (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, console.error)
    return unsub
  }, [])

  // When a plan expands, load its nested data
  const loadPlanData = async (planId) => {
    if (tracksMap[planId]) return // already loaded

    // Load tracks
    const tSnap = await getDocs(query(collection(db, "tracks"), where("plan_id", "==", planId)))
    const tracks = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    setTracksMap((prev) => ({ ...prev, [planId]: tracks }))

    // Load modules for each track
    await Promise.all(
      tracks.map(async (track) => {
        const mSnap = await getDocs(query(collection(db, "modules"), where("track_id", "==", track.id)))
        const modules = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setModulesMap((prev) => ({ ...prev, [track.id]: modules }))

        // Load milestones for each module
        await Promise.all(
          modules.map(async (mod) => {
            const msSnap = await getDocs(query(collection(db, "milestones"), where("module_id", "==", mod.id)))
            const milestones = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
            setMilestonesMap((prev) => ({ ...prev, [mod.id]: milestones }))

            // Load tasks for each milestone
            await Promise.all(
              milestones.map(async (ms) => {
                const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", ms.id)))
                const tasks = tskSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
                setTasksMap((prev) => ({ ...prev, [ms.id]: tasks }))
              })
            )
          })
        )
      })
    )
  }

  const togglePlan = (planId) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null)
    } else {
      setExpandedPlan(planId)
      loadPlanData(planId)
    }
  }

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) return
    setSavingPlan(true)
    try {
      if (editingPlan) {
        await updateDoc(doc(db, "plans", editingPlan.id), {
          name: planForm.name.trim(),
          duration_weeks: Number(planForm.duration_weeks),
          is_template: planForm.is_template,
        })
      } else {
        await addDoc(collection(db, "plans"), {
          name: planForm.name.trim(),
          duration_weeks: Number(planForm.duration_weeks),
          is_template: planForm.is_template,
          track_ids: [],
          created_by: user?.uid,
          created_at: serverTimestamp(),
        })
      }
      setPlanDialogOpen(false)
      setEditingPlan(null)
      setPlanForm({ name: "", duration_weeks: 8, is_template: false })
    } catch (err) {
      console.error(err)
      alert("Failed to save plan: " + err.message)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleClonePlan = async (plan) => {
    setSaving(true)
    try {
      await addDoc(collection(db, "plans"), {
        name: `${plan.name} (Copy)`,
        duration_weeks: plan.duration_weeks,
        is_template: false,
        track_ids: [],
        created_by: user?.uid,
        created_at: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
      alert("Failed to clone plan: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTrack = async () => {
    if (!trackForm.label.trim()) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, "tracks"), {
        label: trackForm.label.trim(),
        category: trackForm.category,
        plan_id: trackDialog.plan_id,
        order: trackForm.order || 0,
      })
      await updateDoc(doc(db, "plans", trackDialog.plan_id), {
        track_ids: [...(plans.find((p) => p.id === trackDialog.plan_id)?.track_ids || []), ref.id],
      })
      setTracksMap((prev) => ({
        ...prev,
        [trackDialog.plan_id]: [
          ...(prev[trackDialog.plan_id] || []),
          { id: ref.id, label: trackForm.label.trim(), category: trackForm.category, plan_id: trackDialog.plan_id, order: trackForm.order || 0 },
        ],
      }))
      setTrackDialog({ open: false, plan_id: null })
      setTrackForm({ label: "", category: "frontend", order: 0 })
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddModule = async () => {
    if (!moduleForm.title.trim()) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, "modules"), {
        title: moduleForm.title.trim(),
        track_id: moduleDialog.track_id,
        order: moduleForm.order || 0,
      })
      setModulesMap((prev) => ({
        ...prev,
        [moduleDialog.track_id]: [
          ...(prev[moduleDialog.track_id] || []),
          { id: ref.id, title: moduleForm.title.trim(), track_id: moduleDialog.track_id, order: moduleForm.order || 0 },
        ],
      }))
      setModuleDialog({ open: false, track_id: null })
      setModuleForm({ title: "", order: 0 })
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddMilestone = async () => {
    if (!milestoneForm.title.trim()) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, "milestones"), {
        title: milestoneForm.title.trim(),
        week_number: Number(milestoneForm.week_number),
        module_id: milestoneDialog.module_id,
      })
      setMilestonesMap((prev) => ({
        ...prev,
        [milestoneDialog.module_id]: [
          ...(prev[milestoneDialog.module_id] || []),
          { id: ref.id, title: milestoneForm.title.trim(), week_number: Number(milestoneForm.week_number), module_id: milestoneDialog.module_id },
        ],
      }))
      setMilestoneDialog({ open: false, module_id: null })
      setMilestoneForm({ title: "", week_number: 1 })
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const tSnap = await getDocs(query(collection(db, "tracks"), where("plan_id", "==", deleteTarget.id)))
      const trackIds = tSnap.docs.map((d) => d.id)

      const moduleIds = []
      for (const trackId of trackIds) {
        const mSnap = await getDocs(query(collection(db, "modules"), where("track_id", "==", trackId)))
        mSnap.docs.forEach((d) => moduleIds.push(d.id))
        await deleteDoc(doc(db, "tracks", trackId))
      }

      const milestoneIds = []
      for (const modId of moduleIds) {
        const msSnap = await getDocs(query(collection(db, "milestones"), where("module_id", "==", modId)))
        msSnap.docs.forEach((d) => milestoneIds.push(d.id))
        await deleteDoc(doc(db, "modules", modId))
      }

      for (const msId of milestoneIds) {
        const tskSnap = await getDocs(query(collection(db, "tasks"), where("milestone_id", "==", msId)))
        await Promise.all(tskSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))
        await deleteDoc(doc(db, "milestones", msId))
      }

      await deleteDoc(doc(db, "plans", deleteTarget.id))
      setDeleteTarget(null)
      if (expandedPlan === deleteTarget.id) setExpandedPlan(null)
    } catch (err) {
      console.error(err)
      alert("Failed to delete plan: " + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, "tasks"), {
        title: taskForm.title.trim(),
        type: taskForm.type,
        content: taskForm.content.trim(),
        milestone_id: taskDialog.milestone_id,
        order: taskForm.order || 0,
      })
      setTasksMap((prev) => ({
        ...prev,
        [taskDialog.milestone_id]: [
          ...(prev[taskDialog.milestone_id] || []),
          { id: ref.id, title: taskForm.title.trim(), type: taskForm.type, content: taskForm.content, milestone_id: taskDialog.milestone_id, order: taskForm.order || 0 },
        ],
      }))
      setTaskDialog({ open: false, milestone_id: null })
      setTaskForm({ title: "", type: "reading", content: "", order: 0 })
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan Builder</h1>
          <p className="text-muted-foreground text-sm">
            Build internship plans with tracks, modules, milestones, and tasks.
          </p>
        </div>
        <Button onClick={() => { setEditingPlan(null); setPlanForm({ name: "", duration_weeks: 8, is_template: false }); setPlanDialogOpen(true) }}>
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No plans yet</p>
            <Button className="mt-4" onClick={() => setPlanDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Create your first plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isOpen = expandedPlan === plan.id
            const tracks = tracksMap[plan.id] || []

            return (
              <Card key={plan.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full text-left cursor-pointer"
                  onClick={() => togglePlan(plan.id)}
                  onKeyDown={(e) => e.key === "Enter" && togglePlan(plan.id)}
                >
                  <CardHeader className="flex flex-row items-center gap-3 py-4">
                    <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{plan.name}</span>
                        {plan.is_template && <Badge variant="secondary" className="text-xs">Template</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {plan.duration_weeks} week{plan.duration_weeks !== 1 ? "s" : ""}
                        {(plan.track_ids || []).length > 0 && ` · ${plan.track_ids.length} track${plan.track_ids.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingPlan(plan)
                          setPlanForm({ name: plan.name, duration_weeks: plan.duration_weeks, is_template: plan.is_template })
                          setPlanDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleClonePlan(plan)} disabled={saving}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(plan)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </CardHeader>
                </div>

                {isOpen && (
                  <CardContent className="pt-0 pb-4 space-y-4">
                    <Separator />

                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Tracks</h4>
                      <Button size="sm" variant="outline" onClick={() => setTrackDialog({ open: true, plan_id: plan.id })}>
                        <Plus className="h-3 w-3" /> Add Track
                      </Button>
                    </div>

                    {tracks.length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-4">No tracks yet. Add a track to get started.</p>
                    ) : (
                      <div className="space-y-4 pl-2">
                        {[...tracks].sort((a, b) => (a.order || 0) - (b.order || 0)).map((track) => {
                          const modules = modulesMap[track.id] || []
                          return (
                            <div key={track.id} className="border border-border rounded-lg overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                                <Badge variant="outline" className="text-xs capitalize">{track.category}</Badge>
                                <span className="font-medium text-sm">{track.label}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto h-7 text-xs"
                                  onClick={() => setModuleDialog({ open: true, track_id: track.id })}
                                >
                                  <Plus className="h-3 w-3" /> Module
                                </Button>
                              </div>

                              {modules.length > 0 && (
                                <div className="divide-y divide-border">
                                  {[...modules].sort((a, b) => (a.order || 0) - (b.order || 0)).map((mod) => {
                                    const milestones = milestonesMap[mod.id] || []
                                    return (
                                      <div key={mod.id} className="px-3 py-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-sm font-medium">{mod.title}</span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="ml-auto h-6 text-xs"
                                            onClick={() => setMilestoneDialog({ open: true, module_id: mod.id })}
                                          >
                                            <Plus className="h-3 w-3" /> Milestone
                                          </Button>
                                        </div>

                                        {milestones.length > 0 && (
                                          <div className="ml-5 space-y-2">
                                            {[...milestones].sort((a, b) => (a.week_number || 0) - (b.week_number || 0)).map((ms) => {
                                              const tasks = tasksMap[ms.id] || []
                                              return (
                                                <div key={ms.id} className="space-y-1.5">
                                                  <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-xs font-semibold">
                                                      Week {ms.week_number} · {ms.title}
                                                    </span>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="ml-auto h-6 text-xs"
                                                      onClick={() => setTaskDialog({ open: true, milestone_id: ms.id })}
                                                    >
                                                      <Plus className="h-3 w-3" /> Task
                                                    </Button>
                                                  </div>

                                                  {tasks.length > 0 && (
                                                    <div className="ml-5 space-y-1">
                                                      {[...tasks].sort((a, b) => (a.order || 0) - (b.order || 0)).map((task) => (
                                                        <div key={task.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/30 text-xs">
                                                          <TaskTypeIcon type={task.type} className="text-muted-foreground shrink-0" />
                                                          <span className="truncate">{task.title}</span>
                                                          <Badge variant="outline" className="text-xs capitalize ml-auto shrink-0">{task.type}</Badge>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Frontend Fundamentals 2025"
                value={planForm.name}
                onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (weeks)</Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={planForm.duration_weeks}
                onChange={(e) => setPlanForm((f) => ({ ...f, duration_weeks: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_template"
                checked={planForm.is_template}
                onCheckedChange={(v) => setPlanForm((f) => ({ ...f, is_template: v }))}
              />
              <Label htmlFor="is_template">Save as template</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSavePlan} disabled={!planForm.name.trim() || savingPlan}>
              {savingPlan ? "Saving..." : editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Track Dialog */}
      <Dialog open={trackDialog.open} onOpenChange={(open) => setTrackDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Track</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Label <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. React Fundamentals"
                value={trackForm.label}
                onChange={(e) => setTrackForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={trackForm.category} onValueChange={(v) => setTrackForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Input type="number" min={0} value={trackForm.order}
                onChange={(e) => setTrackForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAddTrack} disabled={!trackForm.label.trim() || saving}>
              {saving ? "Adding..." : "Add Track"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Module Dialog */}
      <Dialog open={moduleDialog.open} onOpenChange={(open) => setModuleDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Module</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Module Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Introduction to React"
                value={moduleForm.title}
                onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Input type="number" min={0} value={moduleForm.order}
                onChange={(e) => setModuleForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAddModule} disabled={!moduleForm.title.trim() || saving}>
              {saving ? "Adding..." : "Add Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={milestoneDialog.open} onOpenChange={(open) => setMilestoneDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Build a React App"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Week Number</Label>
              <Input type="number" min={1} value={milestoneForm.week_number}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, week_number: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAddMilestone} disabled={!milestoneForm.title.trim() || saving}>
              {saving ? "Adding..." : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium">{deleteTarget?.name}</span>? All tracks, modules, milestones, and tasks inside it will also be deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeletePlan} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialog.open} onOpenChange={(open) => setTaskDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Task Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Read: React Docs - Hooks"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={taskForm.type} onValueChange={(v) => setTaskForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content / Instructions</Label>
              <Textarea
                placeholder="Task description, links, instructions..."
                value={taskForm.content}
                onChange={(e) => setTaskForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Input type="number" min={0} value={taskForm.order}
                onChange={(e) => setTaskForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAddTask} disabled={!taskForm.title.trim() || saving}>
              {saving ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
