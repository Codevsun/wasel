import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, onSnapshot, collection, query, where,
  getDocs, updateDoc, orderBy,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
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
  Save, RefreshCw,
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
  rejected: "destructive",
  pending: "warning",
  submitted: "secondary",
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
  const [cohortMap, setCohortMap] = useState({})
  const [groupMap, setGroupMap] = useState({})
  const [note, setNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [loading, setLoading] = useState(true)

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState(false)
  const [allCohorts, setAllCohorts] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [newCohort, setNewCohort] = useState("")
  const [newGroup, setNewGroup] = useState("")
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    const unsubs = []

    // Intern doc
    unsubs.push(
      onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() }
          setIntern(data)
          setNote(data.note || "")
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

    // Submissions
    const subQ = query(
      collection(db, "submissions"),
      where("user_id", "==", uid),
      orderBy("submitted_at", "desc")
    )
    unsubs.push(
      onSnapshot(subQ, (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setSubmissions(all.filter((s) => s.type !== "quiz"))
        setQuizResults(all.filter((s) => s.type === "quiz"))
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

  const handleSaveNote = async () => {
    setSavingNote(true)
    try {
      await updateDoc(doc(db, "users", uid), { note })
    } catch (err) {
      console.error(err)
      alert("Failed to save note: " + err.message)
    } finally {
      setSavingNote(false)
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
      <Tabs defaultValue="overview">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Overall Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {progress ? `${Math.round(progress.overall_pct ?? 0)}%` : "—"}
                </div>
                {progress && <Progress value={progress.overall_pct ?? 0} className="h-2" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Tasks Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(progress?.completed_tasks || []).length}
                </div>
                <p className="text-xs text-muted-foreground">tasks done</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Track Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {(intern.track_preference || []).length > 0
                    ? intern.track_preference.map((t) => (
                        <Badge key={t} variant="outline" className="capitalize text-xs">{t}</Badge>
                      ))
                    : <span className="text-sm text-muted-foreground">None set</span>
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Track Progress Bars */}
          {Object.keys(trackPct).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progress by Track</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(trackPct).map(([trackId, pct]) => (
                  <div key={trackId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium capitalize">{trackId}</span>
                      <span className="text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Milestone Status */}
          {progress?.milestone_status && Object.keys(progress.milestone_status).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Milestone Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(progress.milestone_status).map(([milestoneId, status]) => (
                    <div key={milestoneId} className="flex items-center gap-3">
                      {status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : status === "in_progress" ? (
                        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className="text-sm capitalize">
                        Milestone {milestoneId.slice(-4)}
                      </span>
                      <Badge
                        variant={
                          status === "completed" ? "success" :
                          status === "in_progress" ? "warning" : "outline"
                        }
                        className="ml-auto text-xs capitalize"
                      >
                        {status?.replace("_", " ")}
                      </Badge>
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
                    <button
                      key={sub.id}
                      className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
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
                    </button>
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
                    return (
                      <div
                        key={quiz.id}
                        className="flex items-center gap-3 p-3 rounded-md border border-border"
                      >
                        <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Quiz Attempt</p>
                          <p className="text-xs text-muted-foreground">{formatDate(quiz.submitted_at)}</p>
                        </div>
                        {quiz.score !== undefined && quiz.score !== null ? (
                          <span className={cn("text-lg font-bold", scoreColor)}>
                            {quiz.score}%
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Not scored</Badge>
                        )}
                        <Badge
                          variant={statusVariant[quiz.status] || "outline"}
                          className="text-xs capitalize shrink-0"
                        >
                          {quiz.status || "pending"}
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
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trainer Notes</CardTitle>
              <CardDescription>
                Private notes visible only to trainers. Saved to the intern's profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes about this intern's performance, progress, areas for improvement..."
                rows={8}
                className="resize-none"
              />
              <Button onClick={handleSaveNote} disabled={savingNote}>
                <Save className="h-4 w-4" />
                {savingNote ? "Saving..." : "Save Note"}
              </Button>
            </CardContent>
          </Card>
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
