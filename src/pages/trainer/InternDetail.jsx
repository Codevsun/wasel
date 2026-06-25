import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, onSnapshot, collection, query, where,
  getDocs, updateDoc, orderBy,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { loadTrackLabels, loadMilestoneLabels, forceCloseMilestone } from "../../lib/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
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
  Save, RefreshCw, Lock, Plus, Trash2, TrendingUp, Layers,
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

  const handleAddNote = async () => {
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
                  <span className="text-xs text-muted-foreground font-medium">Tracks</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(intern.track_preference || []).length > 0
                    ? intern.track_preference.map((t) => (
                        <Badge key={t} variant="secondary" className="capitalize text-xs">{t}</Badge>
                      ))
                    : <span className="text-sm text-muted-foreground">None set</span>
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {notes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setActiveTab("notes")}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0">
                  {notes.map((n, i) => (
                    <div key={n.id} className={cn("flex gap-3 py-3", i < notes.length - 1 && "border-b border-border")}>
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{n.text}</p>
                        {n.created_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
          {progress?.milestone_status && Object.keys(progress.milestone_status).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Milestones</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0">
                  {Object.entries(progress.milestone_status)
                    .sort(([a], [b]) =>
                      (milestoneLabels[a]?.week_number ?? 0) - (milestoneLabels[b]?.week_number ?? 0)
                    )
                    .map(([milestoneId, status], i, arr) => (
                    <div key={milestoneId} className={cn(
                      "flex items-center gap-3 py-3",
                      i < arr.length - 1 && "border-b border-border"
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
          )}
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
              <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
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
      </Tabs>

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
