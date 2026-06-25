import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, onSnapshot, collection, query, where,
  getDocs, updateDoc, orderBy, addDoc, serverTimestamp, deleteDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { loadTrackLabels, loadMilestoneLabels, forceCloseMilestone } from "../../lib/progress"
import { subscribeToTrainerConfig, getLabelClasses, DEFAULT_TRACKS, DEFAULT_LABELS } from "../../lib/trainerConfig"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Input } from "../../components/ui/input"
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "../../components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  ArrowLeft, Mail, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, Link2, BarChart2, BookOpen, MessageSquare, ChevronRight,
  Save, RefreshCw, Lock, Plus, Trash2, TrendingUp, Layers, X, Pencil, Tag,
  FolderOpen, CalendarDays, FlaskConical, Upload, ExternalLink,
} from "lucide-react"
import { cn } from "../../lib/utils"

function timeAgo(ts) {
  if (!ts) return ""
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(ts) {
  if (!ts) return "—"
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const statusVariant = {
  approved: "success",
  passed: "success",
  rejected: "destructive",
  failed: "destructive",
  pending: "warning",
  submitted: "warning",
}

const EXPECTED_PCT = 40

export default function InternDetail() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [intern, setIntern] = useState(null)
  const [progress, setProgress] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [quizResults, setQuizResults] = useState([])
  const [quizTaskLabels, setQuizTaskLabels] = useState({})
  const [cohortMap, setCohortMap] = useState({})
  const [groupMap, setGroupMap] = useState({})
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [inlineNoteOpen, setInlineNoteOpen] = useState(false)
  const [showAllMilestones, setShowAllMilestones] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState(false)
  const [allCohorts, setAllCohorts] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [newCohort, setNewCohort] = useState("")
  const [newGroup, setNewGroup] = useState("")
  const [reassigning, setReassigning] = useState(false)
  const [trackLabels, setTrackLabels] = useState({})
  const [milestoneLabels, setMilestoneLabels] = useState({})
  const [closingMilestoneId, setClosingMilestoneId] = useState(null)
  const [forceClosing, setForceClosing] = useState(false)

  // Track preferences editing
  const [editingTracks, setEditingTracks] = useState(false)
  const [localTracks, setLocalTracks] = useState([])
  const [trackInput, setTrackInput] = useState("")
  const [savingTracks, setSavingTracks] = useState(false)

  // Trainer labels
  const [labelInput, setLabelInput] = useState("")
  const [editingLabels, setEditingLabels] = useState(false)

  // Assigned tasks (quick + full projects)
  const [assignedProjects, setAssignedProjects] = useState([])
  const [projectOutcomes, setProjectOutcomes] = useState({})
  const [projectSubmissions, setProjectSubmissions] = useState({})

  // Quick task inline add
  const [quickTaskInput, setQuickTaskInput] = useState("")
  const [quickTaskType, setQuickTaskType] = useState("reading")
  const [addingQuickTask, setAddingQuickTask] = useState(false)

  // Full project assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignDialogTab, setAssignDialogTab] = useState("library")
  const [assignForm, setAssignForm] = useState({ title: "", content: "", type: "submission", dueDate: "" })
  const [assigning, setAssigning] = useState(false)
  const [taskTemplates, setTaskTemplates] = useState([])
  const [templateSearch, setTemplateSearch] = useState("")

  // Config from Firestore (tracks & labels defined in Settings)
  const [configTracks, setConfigTracks] = useState(DEFAULT_TRACKS)
  const [configLabels, setConfigLabels] = useState(DEFAULT_LABELS)

  useEffect(() => {
    return subscribeToTrainerConfig((cfg) => {
      setConfigTracks(cfg.tracks)
      setConfigLabels(cfg.labels)
    })
  }, [])

  // Task templates from library
  useEffect(() => {
    const q = query(collection(db, "task_templates"), orderBy("created_at", "desc"))
    return onSnapshot(q, (snap) => {
      setTaskTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, console.error)
  }, [])

  // Assigned projects: tasks where assigned_to == uid
  useEffect(() => {
    const q = query(collection(db, "tasks"), where("assigned_to", "==", uid))
    const unsub = onSnapshot(q, async (snap) => {
      const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
      setAssignedProjects(projects)

      if (!projects.length) return

      const ids = projects.map((p) => p.id)
      // outcomes
      const outcomeSnap = await getDocs(query(
        collection(db, "outcomes"),
        where("user_id", "==", uid),
        where("task_id", "in", ids)
      ))
      const oMap = {}
      outcomeSnap.docs.forEach((d) => { oMap[d.data().task_id] = d.data() })
      setProjectOutcomes(oMap)

      // latest submissions
      const subSnap = await getDocs(query(
        collection(db, "submissions"),
        where("user_id", "==", uid),
        where("task_id", "in", ids)
      ))
      const sMap = {}
      subSnap.docs.forEach((d) => {
        const data = d.data()
        if (!sMap[data.task_id] || (data.version ?? 1) > (sMap[data.task_id].version ?? 1)) {
          sMap[data.task_id] = { id: d.id, ...data }
        }
      })
      setProjectSubmissions(sMap)
    }, console.error)
    return unsub
  }, [uid])

  useEffect(() => {
    if (!closingMilestoneId) return
    const timer = setTimeout(() => setClosingMilestoneId(null), 3000)
    return () => clearTimeout(timer)
  }, [closingMilestoneId])

  useEffect(() => {
    const unsubs = []

    // Intern doc
    unsubs.push(
      onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() }
          setIntern(data)
          // support both old single `note` field and new `notes` array
          const existing = data.notes || []
          if (!existing.length && data.note) {
            setNotes([{ id: "legacy", text: data.note, created_at: null }])
          } else {
            setNotes(existing)
          }
        }
        setLoading(false)
      }, console.error)
    )

    // Progress
    unsubs.push(
      onSnapshot(doc(db, "progress", uid), (snap) => {
        if (snap.exists()) setProgress(snap.data())
      }, console.error)
    )

    // Submissions (project/link tasks — quizzes live in quiz_results)
    const subQ = query(
      collection(db, "submissions"),
      where("user_id", "==", uid),
      orderBy("submitted_at", "desc")
    )
    unsubs.push(
      onSnapshot(subQ, (snap) => {
        setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    // Quiz attempts
    const quizQ = query(
      collection(db, "quiz_results"),
      where("user_id", "==", uid),
      orderBy("taken_at", "desc")
    )
    unsubs.push(
      onSnapshot(quizQ, (snap) => {
        setQuizResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    // Cohorts
    getDocs(collection(db, "cohorts")).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setAllCohorts(list)
      setCohortMap(Object.fromEntries(list.map((c) => [c.id, c])))
    })

    // Groups
    getDocs(collection(db, "groups")).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setAllGroups(list)
      setGroupMap(Object.fromEntries(list.map((g) => [g.id, g])))
    })

    return () => unsubs.forEach((u) => u())
  }, [uid])

  useEffect(() => {
    if (!progress?.plan_id) return
    loadTrackLabels(progress.plan_id).then(setTrackLabels).catch(console.error)
    loadMilestoneLabels(progress.plan_id).then(setMilestoneLabels).catch(console.error)
  }, [progress?.plan_id])

  useEffect(() => {
    const taskIds = [...new Set(quizResults.map((q) => q.task_id).filter(Boolean))]
    if (!taskIds.length) {
      setQuizTaskLabels({})
      return
    }
    Promise.all(taskIds.map((id) => getDoc(doc(db, "tasks", id))))
      .then((snaps) => {
        const map = {}
        snaps.forEach((s) => {
          if (s.exists()) map[s.id] = s.data().title || "Quiz"
        })
        setQuizTaskLabels(map)
      })
      .catch(console.error)
  }, [quizResults])

  const handleAddNote = async (closeInline = false) => {
    if (!newNote.trim()) return
    setAddingNote(true)
    try {
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        text: newNote.trim(),
        created_at: new Date().toISOString(),
      }
      const updated = [entry, ...notes]
      await updateDoc(doc(db, "users", uid), { notes: updated, note: "" })
      setNewNote("")
      if (closeInline) setInlineNoteOpen(false)
    } catch (err) {
      console.error(err)
      alert("Failed to save note: " + err.message)
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (id) => {
    const updated = notes.filter((n) => n.id !== id)
    try {
      await updateDoc(doc(db, "users", uid), { notes: updated })
    } catch (err) {
      console.error(err)
      alert("Failed to delete note: " + err.message)
    }
  }

  const handleForceCloseMilestone = async (milestoneId) => {
    if (closingMilestoneId !== milestoneId) {
      setClosingMilestoneId(milestoneId)
      return
    }

    setForceClosing(true)
    try {
      await forceCloseMilestone(uid, milestoneId)
      setClosingMilestoneId(null)
    } catch (err) {
      console.error(err)
      alert("Failed to close milestone: " + err.message)
    } finally {
      setForceClosing(false)
    }
  }

  const handleReassign = async () => {
    if (!newCohort) return
    setReassigning(true)
    try {
      await updateDoc(doc(db, "users", uid), {
        cohort_ids: [newCohort],
        group_ids: newGroup ? [newGroup] : [],
      })
      setReassignOpen(false)
    } catch (err) {
      console.error(err)
      alert("Failed to reassign: " + err.message)
    } finally {
      setReassigning(false)
    }
  }

  const handleAddQuickTask = async () => {
    if (!quickTaskInput.trim()) return
    setAddingQuickTask(true)
    try {
      await addDoc(collection(db, "tasks"), {
        title: quickTaskInput.trim(),
        content: "",
        type: quickTaskType,
        assigned_to: uid,
        assigned_by: authUser?.uid || null,
        is_quick: true,
        is_assigned: true,
        created_at: serverTimestamp(),
      })
      setQuickTaskInput("")
    } catch (err) {
      console.error(err)
      alert("Failed to add quick task: " + err.message)
    } finally {
      setAddingQuickTask(false)
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, "tasks", taskId))
    } catch (err) {
      console.error(err)
    }
  }

  const handleAssignProject = async () => {
    if (!assignForm.title.trim()) return
    setAssigning(true)
    try {
      await addDoc(collection(db, "tasks"), {
        title: assignForm.title.trim(),
        content: assignForm.content.trim(),
        type: assignForm.type,
        assigned_to: uid,
        assigned_by: authUser?.uid || null,
        due_date: assignForm.dueDate || null,
        is_assigned: true,
        created_at: serverTimestamp(),
      })
      setAssignForm({ title: "", content: "", type: "submission", dueDate: "" })
      setAssignDialogOpen(false)
    } catch (err) {
      console.error(err)
      alert("Failed to assign project: " + err.message)
    } finally {
      setAssigning(false)
    }
  }

  const startEditingTracks = () => {
    setLocalTracks([...(intern?.track_preference || [])])
    setEditingTracks(true)
  }

  const handleAddTrack = (track) => {
    const trimmed = track.trim()
    if (!trimmed || localTracks.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return
    setLocalTracks([...localTracks, trimmed])
    setTrackInput("")
  }

  const handleSaveTracks = async () => {
    setSavingTracks(true)
    try {
      await updateDoc(doc(db, "users", uid), { track_preference: localTracks })
      setEditingTracks(false)
    } catch (err) {
      console.error(err)
      alert("Failed to save tracks: " + err.message)
    } finally {
      setSavingTracks(false)
    }
  }

  const handleAddLabel = async (label) => {
    const trimmed = label.trim()
    const current = intern?.trainer_labels || []
    if (!trimmed || current.includes(trimmed)) return
    try {
      await updateDoc(doc(db, "users", uid), { trainer_labels: [...current, trimmed] })
    } catch (err) {
      console.error(err)
    }
    setLabelInput("")
  }

  const handleRemoveLabel = async (label) => {
    const updated = (intern?.trainer_labels || []).filter((l) => l !== label)
    try {
      await updateDoc(doc(db, "users", uid), { trainer_labels: updated })
    } catch (err) {
      console.error(err)
    }
  }

  const filteredGroupsForCohort = allGroups.filter((g) => g.cohort_id === newCohort)
  const isAtRisk = progress && typeof progress.overall_pct === "number" && progress.overall_pct < EXPECTED_PCT - 10

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!intern) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium">Intern not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/trainer/interns")}>
          <ArrowLeft className="h-4 w-4" />
          Back to queue
        </Button>
      </div>
    )
  }

  const initials = intern.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
  const cohortNames = (intern.cohort_ids || []).map((cid) => cohortMap[cid]?.name).filter(Boolean)
  const groupNames = (intern.group_ids || []).map((gid) => groupMap[gid]?.name).filter(Boolean)
  const trackPct = progress?.track_pct || {}
  const trainerClosedMilestones = new Set(progress?.trainer_closed_milestones || [])

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/trainer/interns")}>
        <ArrowLeft className="h-4 w-4" />
        Intern Queue
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{intern.name}</h1>
              {isAtRisk && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  At Risk
                </Badge>
              )}
              <Badge
                variant={
                  intern.status === "active" ? "success" :
                  intern.status === "graduated" ? "default" :
                  intern.status === "withdrawn" ? "destructive" : "secondary"
                }
                className="capitalize"
              >
                {intern.status || "unknown"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <Mail className="h-3.5 w-3.5" />
              <span className="text-sm">{intern.email}</span>
            </div>
            <div className="flex gap-2 mt-1.5 flex-wrap text-sm text-muted-foreground">
              {cohortNames.length > 0 && (
                <span>Cohort: <span className="text-foreground font-medium">{cohortNames.join(", ")}</span></span>
              )}
              {groupNames.length > 0 && (
                <span>· Group: <span className="text-foreground font-medium">{groupNames.join(", ")}</span></span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setReassignOpen(true)}>
          <RefreshCw className="h-4 w-4" />
          Reassign
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions
            {submissions.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">{submissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quiz">Quiz Results</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="projects">
            Projects
            {assignedProjects.filter(p => !p.is_quick).length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">{assignedProjects.filter(p => !p.is_quick).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Overall</span>
                </div>
                <div className={cn(
                  "text-3xl font-bold tracking-tight mb-2.5",
                  progress && (progress.overall_pct ?? 0) < 30 ? "text-red-500" :
                  progress && (progress.overall_pct ?? 0) >= 70 ? "text-green-500" : ""
                )}>
                  {progress ? `${Math.round(progress.overall_pct ?? 0)}%` : "—"}
                </div>
                {progress && (
                  <Progress
                    value={progress.overall_pct ?? 0}
                    className={cn("h-1.5", (progress.overall_pct ?? 0) < 30 && "[&>div]:bg-red-500", (progress.overall_pct ?? 0) >= 70 && "[&>div]:bg-green-500")}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Tasks</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {(progress?.completed_tasks || []).length}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                    <Layers className="h-4.5 w-4.5 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    {!editingTracks && (
                      <button
                        onClick={startEditingTracks}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground font-medium">Tracks</span>
                  </div>
                </div>

                {editingTracks ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {localTracks.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium"
                        >
                          {t}
                          <button
                            onClick={() => setLocalTracks(localTracks.filter((x) => x !== t))}
                            className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        value={trackInput}
                        onChange={(e) => setTrackInput(e.target.value)}
                        placeholder="Add track..."
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleAddTrack(trackInput) }
                        }}
                      />
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={() => handleAddTrack(trackInput)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {configTracks.filter((s) => !localTracks.map(t => t.toLowerCase()).includes(s.toLowerCase())).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleAddTrack(s)}
                          className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" className="h-7 text-xs" onClick={handleSaveTracks} disabled={savingTracks}>
                        {savingTracks ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingTracks(false); setTrackInput("") }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(intern.track_preference || []).length > 0
                      ? intern.track_preference.map((t) => (
                          <Badge key={t} variant="secondary" className="capitalize text-xs">{t}</Badge>
                        ))
                      : (
                        <button onClick={startEditingTracks} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <Plus className="h-3.5 w-3.5 inline mr-1 opacity-60" />
                          Add tracks...
                        </button>
                      )
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Tasks */}
          {(() => {
            const quickTasks = assignedProjects.filter((p) => p.is_quick)
            const typeIcon = { reading: BookOpen, lab: FlaskConical, submission: Upload }
            const typeColor = { reading: "text-blue-500 bg-blue-500/10", lab: "text-purple-500 bg-purple-500/10", submission: "text-green-500 bg-green-500/10" }

            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Quick Tasks
                    </CardTitle>
                    {quickTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">{quickTasks.length}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Inline add row */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a quick task..."
                      value={quickTaskInput}
                      onChange={(e) => setQuickTaskInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddQuickTask() }}
                      className="h-8 text-sm flex-1"
                    />
                    <Select value={quickTaskType} onValueChange={setQuickTaskType}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="lab">Lab</SelectItem>
                        <SelectItem value="submission">Submission</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 px-3 shrink-0"
                      onClick={handleAddQuickTask}
                      disabled={addingQuickTask || !quickTaskInput.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Quick task list */}
                  {quickTasks.length > 0 && (
                    <div className="divide-y divide-border">
                      {quickTasks.map((task) => {
                        const outcome = projectOutcomes[task.id]
                        const status = outcome?.status || "not_started"
                        const isDone = status === "passed" || status === "approved"
                        const isSubmitted = status === "submitted"
                        const Icon = typeIcon[task.type] || BookOpen
                        const colors = (typeColor[task.type] || "text-muted-foreground bg-muted").split(" ")

                        return (
                          <div key={task.id} className="flex items-center gap-2.5 py-2">
                            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", colors[1])}>
                              <Icon className={cn("h-3 w-3", colors[0])} />
                            </div>
                            <span className={cn("flex-1 text-sm truncate", isDone && "line-through text-muted-foreground")}>
                              {task.title}
                            </span>
                            {isDone && <Badge variant="success" className="text-xs shrink-0">Done</Badge>}
                            {isSubmitted && <Badge variant="secondary" className="text-xs shrink-0">Submitted</Badge>}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {quickTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">Type a task above and press Enter to assign it instantly.</p>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Trainer Labels */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Trainer Labels
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setEditingLabels((v) => !v)}
                >
                  {editingLabels ? "Done" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(intern.trainer_labels || []).map((label) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                      getLabelClasses(configLabels.find(l => l.name === label)?.color)
                    )}
                  >
                    {label}
                    {editingLabels && (
                      <button onClick={() => handleRemoveLabel(label)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {(intern.trainer_labels || []).length === 0 && !editingLabels && (
                  <button
                    onClick={() => setEditingLabels(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1 opacity-60" />
                    Add labels...
                  </button>
                )}
              </div>

              {editingLabels && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="Custom label..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleAddLabel(labelInput) }
                      }}
                    />
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => handleAddLabel(labelInput)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {configLabels.filter((l) => !(intern.trainer_labels || []).includes(l.name)).map((l) => (
                      <button
                        key={l.name}
                        onClick={() => handleAddLabel(l.name)}
                        className={cn(
                          "rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors hover:border-solid opacity-70 hover:opacity-100",
                          getLabelClasses(l.color)
                        )}
                      >
                        + {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Notes {notes.length > 0 && <span className="text-xs font-normal normal-case">({notes.length})</span>}
                </CardTitle>
                {notes.length > 3 && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveTab("notes")}>
                    View all {notes.length}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Inline add */}
              {inlineNoteOpen ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write a note..."
                    rows={3}
                    className="resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(true)
                      if (e.key === "Escape") { setInlineNoteOpen(false); setNewNote("") }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAddNote(true)} disabled={addingNote || !newNote.trim()}>
                      {addingNote ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setInlineNoteOpen(false); setNewNote("") }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setInlineNoteOpen(true)}
                  className="w-full text-left text-sm text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2.5 hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1.5 opacity-60" />
                  Add a note...
                </button>
              )}

              {/* Last 3 notes */}
              {notes.slice(0, 3).map((n, i) => (
                <div key={n.id} className={cn("flex gap-3 py-2", i < Math.min(notes.length, 3) - 1 && "border-b border-border")}>
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{n.text}</p>
                    {n.created_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.created_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Track Progress */}
          {Object.keys(trackPct).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Progress by Track</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(trackPct).map(([trackId, pct]) => (
                  <div key={trackId}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium capitalize">{trackLabels[trackId] || "Track"}</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        pct < 30 ? "text-red-500" : pct >= 70 ? "text-green-500" : "text-muted-foreground"
                      )}>{Math.round(pct)}%</span>
                    </div>
                    <Progress
                      value={pct}
                      className={cn("h-1.5", pct < 30 && "[&>div]:bg-red-500", pct >= 70 && "[&>div]:bg-green-500")}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Milestone Timeline */}
          {progress?.milestone_status && Object.keys(progress.milestone_status).length > 0 && (() => {
            const sorted = Object.entries(progress.milestone_status).sort(
              ([a], [b]) => (milestoneLabels[a]?.week_number ?? 0) - (milestoneLabels[b]?.week_number ?? 0)
            )
            const visible = showAllMilestones ? sorted : sorted.slice(0, 3)
            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Milestones</CardTitle>
                    {sorted.length > 3 && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAllMilestones((v) => !v)}>
                        {showAllMilestones ? "Show less" : `Show all ${sorted.length}`}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-0">
                    {visible.map(([milestoneId, status], i) => (
                      <div key={milestoneId} className={cn(
                        "flex items-center gap-3 py-3",
                        i < visible.length - 1 && "border-b border-border"
                      )}>
                        <div className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          status === "completed" ? "bg-green-500/10" :
                          status === "in_progress" ? "bg-amber-500/10" : "bg-muted"
                        )}>
                          {status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : status === "in_progress" ? (
                            <Clock className="h-4 w-4 text-amber-500" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {milestoneLabels[milestoneId]?.title ?? "Milestone"}
                          </span>
                          {milestoneLabels[milestoneId]?.week_number && (
                            <span className="text-xs text-muted-foreground ml-2">Week {milestoneLabels[milestoneId].week_number}</span>
                          )}
                          {trainerClosedMilestones.has(milestoneId) && (
                            <Badge variant="secondary" className="ml-2 text-xs">Trainer closed</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {status !== "completed" && (
                            <Button
                              size="sm"
                              variant={closingMilestoneId === milestoneId ? "destructive" : "ghost"}
                              className="h-7 text-xs"
                              disabled={forceClosing}
                              onClick={() => handleForceCloseMilestone(milestoneId)}
                            >
                              <Lock className="h-3 w-3" />
                              {closingMilestoneId === milestoneId ? "Confirm?" : "Close"}
                            </Button>
                          )}
                          <Badge
                            variant={
                              status === "completed" ? "success" :
                              status === "in_progress" ? "warning" : "outline"
                            }
                            className="text-xs capitalize"
                          >
                            {status?.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>

        {/* Submissions */}
        <TabsContent value="submissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <Button
                      key={sub.id}
                      variant="ghost"
                      className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left h-auto justify-start"
                      onClick={() => navigate(`/trainer/reviews/${sub.id}`)}
                    >
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        sub.status === "approved" ? "bg-green-500" :
                        sub.status === "rejected" ? "bg-red-500" : "bg-amber-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{sub.type || "submission"}</span>
                          {sub.version > 1 && (
                            <Badge variant="secondary" className="text-xs py-0">v{sub.version}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(sub.submitted_at)}</p>
                      </div>
                      <Badge variant={statusVariant[sub.status] || "outline"} className="text-xs capitalize shrink-0">
                        {sub.status || "pending"}
                      </Badge>
                      {sub.trainer_feedback && (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quiz Results */}
        <TabsContent value="quiz" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quiz Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              {quizResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <BarChart2 className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No quiz attempts yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {quizResults.map((quiz) => {
                    const scoreColor =
                      quiz.score >= 80 ? "text-green-600" :
                      quiz.score >= 60 ? "text-amber-600" : "text-red-600"
                    const status = quiz.passed ? "passed" : "failed"
                    return (
                      <div
                        key={quiz.id}
                        className="flex items-center gap-3 p-3 rounded-md border border-border"
                      >
                        <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {quizTaskLabels[quiz.task_id] || "Quiz"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Attempt {quiz.attempt ?? 1} · {formatDate(quiz.taken_at)}
                          </p>
                        </div>
                        {quiz.score !== undefined && quiz.score !== null ? (
                          <span className={cn("text-lg font-bold", scoreColor)}>
                            {quiz.score}%
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Not scored</Badge>
                        )}
                        <Badge
                          variant={statusVariant[status] || "outline"}
                          className="text-xs capitalize shrink-0"
                        >
                          {status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this intern..."
                rows={4}
                className="resize-none"
              />
              <Button onClick={() => handleAddNote(false)} disabled={addingNote || !newNote.trim()}>
                <Plus className="h-4 w-4" />
                {addingNote ? "Saving..." : "Add Note"}
              </Button>
            </CardContent>
          </Card>

          {notes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {notes.length} Note{notes.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                {notes.map((n) => (
                  <div key={n.id} className="py-3 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap">{n.text}</p>
                      {n.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteNote(n.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects" className="mt-4 space-y-4">
          {(() => {
            const fullProjects = assignedProjects.filter((p) => !p.is_quick)
            return (<>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {fullProjects.length === 0 ? "No projects assigned yet." : `${fullProjects.length} project${fullProjects.length !== 1 ? "s" : ""} assigned`}
            </p>
            <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Assign Project
            </Button>
          </div>

          {fullProjects.length > 0 && (
            <Card>
              <CardContent className="pt-4 divide-y divide-border space-y-0">
                {fullProjects.map((project) => {
                  const outcome = projectOutcomes[project.id]
                  const submission = projectSubmissions[project.id]
                  const status = outcome?.status || "not_started"

                  const statusConfig = {
                    not_started: { label: "Not Started", variant: "outline" },
                    in_progress: { label: "In Progress", variant: "warning" },
                    submitted: { label: "Submitted", variant: "secondary" },
                    passed: { label: "Approved", variant: "success" },
                    approved: { label: "Approved", variant: "success" },
                    failed: { label: "Rejected", variant: "destructive" },
                  }[status] || { label: status, variant: "outline" }

                  const typeConfig = {
                    submission: { icon: Upload, label: "Submission" },
                    lab: { icon: FlaskConical, label: "Lab" },
                    reading: { icon: BookOpen, label: "Reading" },
                  }[project.type] || { icon: FileText, label: project.type }
                  const TypeIcon = typeConfig.icon

                  return (
                    <div key={project.id} className="py-3 flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{project.title}</span>
                          <Badge variant="outline" className="text-xs">{typeConfig.label}</Badge>
                          <Badge variant={statusConfig.variant} className="text-xs">{statusConfig.label}</Badge>
                        </div>
                        {project.content && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.content}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {project.due_date && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              Due {new Date(project.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          {project.created_at && (
                            <span className="text-xs text-muted-foreground">
                              Assigned {formatDate(project.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      {submission && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => navigate(`/trainer/reviews/${submission.id}`)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                          Review
                        </Button>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
          </>)
          })()}
        </TabsContent>
      </Tabs>

      {/* Assign Task / Project Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => {
        setAssignDialogOpen(open)
        if (!open) { setTemplateSearch(""); setAssignDialogTab("library") }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign to {intern.name}</DialogTitle>
            <DialogDescription>Pick from your library or create a custom task.</DialogDescription>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {[["library", "From Library"], ["custom", "Custom"]].map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setAssignDialogTab(tab)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  assignDialogTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Library tab */}
          {assignDialogTab === "library" && (
            <div className="space-y-3">
              <Input
                placeholder="Search tasks and projects..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="h-8 text-sm"
              />
              {taskTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  <FolderOpen className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  <p>Your library is empty.</p>
                  <button
                    className="text-primary underline underline-offset-2 mt-1 text-xs"
                    onClick={() => navigate("/trainer/task-library")}
                  >
                    Go to Task Library to add templates
                  </button>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
                  {(() => {
                    const q = templateSearch.toLowerCase()
                    const filtered = taskTemplates.filter(
                      (t) => !q || t.title.toLowerCase().includes(q) || (t.content || "").toLowerCase().includes(q)
                    )
                    const quick   = filtered.filter((t) => t.category === "quick_task")
                    const projects = filtered.filter((t) => t.category === "project")

                    const renderGroup = (label, items) => items.length === 0 ? null : (
                      <div key={label}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">{label}</p>
                        {items.map((t) => {
                          const meta = { submission: { icon: Upload, color: "text-green-500", bg: "bg-green-500/10" }, lab: { icon: FlaskConical, color: "text-purple-500", bg: "bg-purple-500/10" }, reading: { icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" } }[t.type] || { icon: FileText, color: "text-muted-foreground", bg: "bg-muted" }
                          const Icon = meta.icon
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                setAssignForm((f) => ({ ...f, title: t.title, content: t.content || "", type: t.type }))
                                setAssignDialogTab("custom")
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent transition-colors text-left group"
                            >
                              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", meta.bg)}>
                                <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{t.title}</p>
                                {t.content && <p className="text-xs text-muted-foreground line-clamp-1">{t.content}</p>}
                              </div>
                              {t.estimated_duration && (
                                <span className="text-xs text-muted-foreground shrink-0">{t.estimated_duration}</span>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    )

                    return filtered.length === 0
                      ? <p className="text-sm text-muted-foreground text-center py-6">No templates match your search.</p>
                      : [renderGroup("Quick Tasks", quick), renderGroup("Projects", projects)]
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Custom tab */}
          {assignDialogTab === "custom" && (
            <div className="space-y-4">
              {assignForm.title && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                  <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium flex-1 truncate">From library: {assignForm.title}</span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setAssignForm({ title: "", content: "", type: "submission", dueDate: "" })}
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus
                  placeholder="e.g. Build a REST API"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Instructions</Label>
                <Textarea
                  placeholder="Describe what the intern needs to do..."
                  rows={3}
                  className="resize-none"
                  value={assignForm.content}
                  onChange={(e) => setAssignForm((f) => ({ ...f, content: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={assignForm.type} onValueChange={(v) => setAssignForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submission">Submission</SelectItem>
                      <SelectItem value="lab">Lab (URL)</SelectItem>
                      <SelectItem value="reading">Reading</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date (optional)</Label>
                  <Input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            {assignDialogTab === "custom" && (
              <Button onClick={handleAssignProject} disabled={assigning || !assignForm.title.trim()}>
                {assigning ? "Assigning..." : "Assign"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Intern</DialogTitle>
            <DialogDescription>
              Move {intern.name} to a different cohort or group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Cohort</Label>
              <Select value={newCohort} onValueChange={(v) => { setNewCohort(v); setNewGroup("") }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {allCohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New Group (optional)</Label>
              <Select
                value={newGroup}
                onValueChange={setNewGroup}
                disabled={!newCohort || filteredGroupsForCohort.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {filteredGroupsForCohort.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleReassign} disabled={!newCohort || reassigning}>
              {reassigning ? "Reassigning..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
