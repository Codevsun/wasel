import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection, doc, onSnapshot, query, where, getDocs, orderBy, limit,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { ensureProgressDoc, loadTrackLabels } from "../../lib/progress"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card"
import { Progress } from "../../components/ui/progress"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Separator } from "../../components/ui/separator"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { cn } from "../../lib/utils"
import {
  CheckCircle2, Clock, BookOpen, ChevronRight, Bell, Star, TrendingUp, Zap,
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

  const [trackLabels, setTrackLabels] = useState({})

  // Initialize progress doc if missing (trainers read progress/{uid})
  useEffect(() => {
    if (!user?.uid || !userDoc?.cohort_ids?.[0]) return
    ensureProgressDoc(user.uid, userDoc.cohort_ids[0]).catch(console.error)
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

  // Load announcements
  useEffect(() => {
    if (!userDoc) return

    async function loadAnnouncements() {
      setAnnouncementsLoading(true)
      try {
        const targets = ["all"]
        if (userDoc.cohort_ids?.[0]) targets.push(userDoc.cohort_ids[0])
        if (userDoc.group_ids?.[0]) targets.push(userDoc.group_ids[0])

        const q = query(
          collection(db, "announcements"),
          where("target", "in", targets),
          orderBy("created_at", "desc"),
          limit(5)
        )
        const snap = await getDocs(q)
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error("Error loading announcements:", err)
      }
      setAnnouncementsLoading(false)
    }

    loadAnnouncements()
  }, [userDoc])

  const overallPct = progressDoc?.overall_pct ?? 0
  const trackPct = progressDoc?.track_pct ?? {}
  const completedCount = (progressDoc?.completed_tasks ?? []).length

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
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {userDoc?.name?.split(" ")[0] || "Intern"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's on your plate today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <p className="text-2xl font-bold text-primary">{Math.round(overallPct)}%</p>
          </div>
          <div className="relative h-14 w-14">
            <svg className="rotate-[-90deg]" viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tasks Completed", value: completedCount, icon: CheckCircle2, color: "text-green-500" },
          { label: "Overall Progress", value: `${Math.round(overallPct)}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Active Track", value: Object.keys(trackPct).length || "—", icon: BookOpen, color: "text-blue-500" },
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
                    <button
                      key={task.id}
                      onClick={() => navigate(`/intern/tasks/${task.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left group"
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
                    </button>
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
  )
}
