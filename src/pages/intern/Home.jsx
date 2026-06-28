import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection, doc, onSnapshot, query, where, getDocs, orderBy, limit, getDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { syncProgressWithCohort, loadTrackLabels } from "../../lib/progress"
import { subscribeAnnouncementsForUser } from "../../lib/announcements"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card"
import { Progress } from "../../components/ui/progress"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Separator } from "../../components/ui/separator"
import { cn } from "../../lib/utils"
import {
  CheckCircle2, Clock, BookOpen, ChevronRight, Bell, Star, TrendingUp, Zap,
  FolderOpen, Upload, FlaskConical,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-3 bg-muted rounded w-2/3" />
      <div className="h-2 bg-muted rounded w-full" />
    </div>
  )
}

function TaskStatusIcon({ status }) {
  if (status === "passed" || status === "approved") return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === "in_progress") return <Clock className="h-4 w-4 text-yellow-500" />
  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
}

export default function InternHome() {
  const { user, userDoc } = useAuth()
  const navigate = useNavigate()

  const [progressDoc, setProgressDoc] = useState(null)
  const [progressLoading, setProgressLoading] = useState(true)

  const [currentTasks, setCurrentTasks] = useState([])
  const [taskDetails, setTaskDetails] = useState({})
  const [tasksLoading, setTasksLoading] = useState(true)

  const [announcements, setAnnouncements] = useState([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)

  const [assignedTasks, setAssignedTasks] = useState([])
  const [assignedOutcomes, setAssignedOutcomes] = useState({})

  const [trackLabels, setTrackLabels] = useState({})

  // Keep progress in sync with the intern's current cohort plan
  useEffect(() => {
    if (!user?.uid || !userDoc?.cohort_ids?.[0]) return
    syncProgressWithCohort(user.uid, userDoc.cohort_ids[0]).catch(console.error)
  }, [user?.uid, userDoc?.cohort_ids])

  // Real-time progress listener
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, "progress", user.uid), (snap) => {
      setProgressDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      setProgressLoading(false)
    })
    return unsub
  }, [user?.uid])

  useEffect(() => {
    if (!progressDoc?.plan_id) return
    loadTrackLabels(progressDoc.plan_id).then(setTrackLabels).catch(console.error)
  }, [progressDoc?.plan_id])

  // Load current milestone tasks (not_started or in_progress)
  useEffect(() => {
    if (!progressDoc) return
    const { milestone_status = {}, plan_id } = progressDoc

    async function loadCurrentTasks() {
      setTasksLoading(true)
      try {
        // Find the first milestone that is in_progress or not_started
        const activeEntry = Object.entries(milestone_status).find(
          ([, status]) => status === "in_progress"
        ) || Object.entries(milestone_status).find(
          ([, status]) => status === "not_started"
        )

        if (!activeEntry) {
          setCurrentTasks([])
          setTasksLoading(false)
          return
        }

        const [activeMilestoneId] = activeEntry

        // Load tasks for this milestone
        const q = query(
          collection(db, "tasks"),
          where("milestone_id", "==", activeMilestoneId),
          orderBy("order")
        )
        const snap = await getDocs(q)
        const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

        // Load outcomes for these tasks
        const completedSet = new Set(progressDoc.completed_tasks || [])
        const enriched = tasks
          .filter((t) => !completedSet.has(t.id))
          .slice(0, 5)

        setCurrentTasks(enriched)

        // Load outcomes for status icons
        if (enriched.length > 0) {
          const outcomeQ = query(
            collection(db, "outcomes"),
            where("user_id", "==", user.uid),
            where("task_id", "in", enriched.map((t) => t.id))
          )
          const outcomeSnap = await getDocs(outcomeQ)
          const map = {}
          outcomeSnap.docs.forEach((d) => {
            map[d.data().task_id] = d.data()
          })
          setTaskDetails(map)
        }
      } catch (err) {
        console.error("Error loading tasks:", err)
      }
      setTasksLoading(false)
    }

    loadCurrentTasks()
  }, [progressDoc, user?.uid])

  // Assigned tasks (direct from trainer)
  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, "tasks"), where("assigned_to", "==", user.uid))
    const unsub = onSnapshot(q, async (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
      setAssignedTasks(tasks)

      if (!tasks.length) return
      const ids = tasks.map((t) => t.id)
      const outcomeSnap = await getDocs(query(
        collection(db, "outcomes"),
        where("user_id", "==", user.uid),
        where("task_id", "in", ids)
      ))
      const map = {}
      outcomeSnap.docs.forEach((d) => { map[d.data().task_id] = d.data() })
      setAssignedOutcomes(map)
    }, console.error)
    return unsub
  }, [user?.uid])

  // Load announcements (client-side audience filter — target column is jsonb in Postgres)
  useEffect(() => {
    if (!userDoc) return
    setAnnouncementsLoading(true)
    const unsub = subscribeAnnouncementsForUser(
      userDoc,
      (items) => {
        setAnnouncements(items)
        setAnnouncementsLoading(false)
      },
      (err) => {
        console.error("Error loading announcements:", err)
        setAnnouncementsLoading(false)
      }
    )
    return unsub
  }, [userDoc])

  const overallPct = progressDoc?.overall_pct ?? 0
  const trackPct = progressDoc?.track_pct ?? {}
  const completedCount = (progressDoc?.completed_tasks ?? []).length

  const trackEntries = Object.entries(trackPct)
  const currentTrackLabel = (() => {
    if (trackEntries.length === 0) return "—"
    const activeId =
      trackEntries.find(([, pct]) => pct < 100)?.[0] ?? trackEntries[0][0]
    return trackLabels[activeId] || "Track"
  })()

  const taskTypeBadge = (type) => {
    const map = {
      reading: { label: "Reading", variant: "secondary" },
      lab: { label: "Lab", variant: "default" },
      quiz: { label: "Quiz", variant: "warning" },
      submission: { label: "Submission", variant: "outline" },
    }
    return map[type] || { label: type, variant: "outline" }
  }

  return (
    <div className="min-h-full">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {userDoc?.name?.split(" ")[0] || "Intern"} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here's what's on your plate today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold text-primary">{Math.round(overallPct)}%</p>
            </div>
            <div className="relative h-14 w-14">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="3"
                  strokeDasharray={`${overallPct} ${100 - overallPct}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tasks Completed", value: completedCount, icon: CheckCircle2, color: "text-green-500" },
          { label: "Overall Progress", value: `${Math.round(overallPct)}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Current Track", value: currentTrackLabel, icon: BookOpen, color: "text-blue-500" },
          { label: "Streak", value: "Active", icon: Zap, color: "text-yellow-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("rounded-md p-2 bg-muted", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assigned Projects */}
      {assignedTasks.length > 0 && (
        <Card className="border-primary/20 bg-primary/3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Assigned to You</CardTitle>
              <Badge variant="secondary" className="ml-auto">{assignedTasks.length}</Badge>
            </div>
            <CardDescription>Projects your trainer assigned directly to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignedTasks.map((task) => {
              const outcome = assignedOutcomes[task.id]
              const status = outcome?.status || "not_started"
              const isDone = status === "passed" || status === "approved"
              const isSubmitted = status === "submitted" || status === "reviewed"

              const TypeIcon = task.type === "lab" ? FlaskConical : task.type === "submission" ? Upload : BookOpen

              return (
                <Button
                  key={task.id}
                  variant="ghost"
                  onClick={() => navigate(`/intern/tasks/${task.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent border border-border transition-colors text-left justify-start h-auto group"
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    isDone ? "bg-green-500/10 text-green-500" :
                    isSubmitted ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <TypeIcon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize py-0">{task.type}</Badge>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {status !== "not_started" && (
                        <span className={cn(
                          "text-xs capitalize",
                          isDone ? "text-green-600" : isSubmitted ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Current tasks */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Tasks</CardTitle>
              <CardDescription>Tasks for your active milestone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-md animate-pulse">
                    <div className="h-4 w-4 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded w-2/3" />
                      <div className="h-2 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : currentTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm text-muted-foreground">No pending tasks for the current milestone.</p>
                </div>
              ) : (
                currentTasks.map((task) => {
                  const outcome = taskDetails[task.id]
                  const status = outcome?.status || "not_started"
                  const badge = taskTypeBadge(task.type)
                  return (
                    <Button
                      key={task.id}
                      variant="ghost"
                      onClick={() => navigate(`/intern/tasks/${task.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left justify-start h-auto group"
                    >
                      <TaskStatusIcon status={status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={badge.variant} className="text-xs px-1.5 py-0">{badge.label}</Badge>
                          {status !== "not_started" && (
                            <span className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Track progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Track Progress</CardTitle>
              <CardDescription>Your progress across each learning track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {progressLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5 animate-pulse">
                    <div className="h-3 bg-muted rounded w-1/4" />
                    <div className="h-2 bg-muted rounded w-full" />
                  </div>
                ))
              ) : Object.keys(trackPct).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No track data yet.</p>
              ) : (
                Object.entries(trackPct).map(([trackId, pct]) => (
                  <div key={trackId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-xs text-muted-foreground">
                        {trackLabels[trackId] || "Track"}
                      </span>
                      <span className="font-semibold">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Announcements + Achievements */}
        <div className="space-y-4">
          {/* Announcements */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Announcements</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcementsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-1 animate-pulse">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-full" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                ))
              ) : announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No announcements.</p>
              ) : (
                announcements.map((ann, idx) => (
                  <div key={ann.id}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div>
                      <p className="text-sm font-medium">{ann.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ann.body}</p>
                      {ann.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(ann.created_at.toDate?.() || new Date(ann.created_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Achievements preview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-base">Achievements</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/intern/achievements")} className="text-xs h-7">
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: "🎯", label: "First Task", earned: completedCount >= 1 },
                  { emoji: "🧠", label: "Quiz Master", earned: false },
                  { emoji: "📈", label: "On Track", earned: overallPct > 0 },
                ].map(({ emoji, label, earned }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-2 border text-center",
                      earned ? "bg-primary/5 border-primary/20" : "opacity-40 grayscale"
                    )}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs font-medium leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      </div>
    </div>
  )
}
