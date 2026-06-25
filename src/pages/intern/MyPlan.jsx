import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { syncProgressWithCohort } from "../../lib/progress"
import { Card, CardContent } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Button } from "../../components/ui/button"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../../components/ui/collapsible"
import { cn } from "../../lib/utils"
import {
  ChevronDown, ChevronRight, Lock, CheckCircle2, Clock, Circle,
  BookOpen, FlaskConical, HelpCircle, Upload,
} from "lucide-react"

// ─── helpers ────────────────────────────────────────────────────────────────

function taskTypeIcon(type) {
  const icons = {
    reading: <BookOpen className="h-3.5 w-3.5" />,
    lab: <FlaskConical className="h-3.5 w-3.5" />,
    quiz: <HelpCircle className="h-3.5 w-3.5" />,
    submission: <Upload className="h-3.5 w-3.5" />,
  }
  return icons[type] || <Circle className="h-3.5 w-3.5" />
}

function taskTypeVariant(type) {
  const map = { reading: "secondary", lab: "default", quiz: "warning", submission: "outline" }
  return map[type] || "outline"
}

function TaskStatusIndicator({ status, locked }) {
  if (locked) return <Lock className="h-4 w-4 text-muted-foreground/50" />
  if (status === "passed" || status === "approved") return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === "in_progress" || status === "submitted" || status === "reviewed")
    return <Clock className="h-4 w-4 text-yellow-500" />
  if (status === "failed") return <div className="h-4 w-4 rounded-full bg-destructive/80" />
  return <Circle className="h-4 w-4 text-muted-foreground/40" />
}

function milestoneCompletionPct(milestoneId, tasks, completedTasks) {
  const milestoneTasks = tasks.filter((t) => t.milestone_id === milestoneId)
  if (!milestoneTasks.length) return 0
  const completedSet = new Set(completedTasks)
  const done = milestoneTasks.filter((t) => completedSet.has(t.id)).length
  return Math.round((done / milestoneTasks.length) * 100)
}

// ─── skeleton ───────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-3 bg-muted rounded w-3/4" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function MyPlan() {
  const { user, userDoc } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [plan, setPlan] = useState(null)
  const [cohort, setCohort] = useState(null)
  const [tracks, setTracks] = useState([])
  const [modules, setModules] = useState([])
  const [milestones, setMilestones] = useState([])
  const [tasks, setTasks] = useState([])
  const [outcomes, setOutcomes] = useState({}) // taskId → outcome
  const [progressDoc, setProgressDoc] = useState(null)

  const [expandedTracks, setExpandedTracks] = useState({})
  const [expandedModules, setExpandedModules] = useState({})
  const [expandedMilestones, setExpandedMilestones] = useState({})

  // Real-time progress
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, "progress", user.uid), (snap) => {
      setProgressDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    })
    return unsub
  }, [user?.uid])

  // Load plan structure
  useEffect(() => {
    if (!userDoc || !user?.uid) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // cohort → plan
        const cohortId = userDoc.cohort_ids?.[0]
        if (!cohortId) throw new Error("No cohort assigned.")

        await syncProgressWithCohort(user.uid, cohortId)

        const cohortSnap = await getDoc(doc(db, "cohorts", cohortId))
        if (!cohortSnap.exists()) throw new Error("Cohort not found.")
        const cohortData = { id: cohortSnap.id, ...cohortSnap.data() }
        setCohort(cohortData)
        const planId = cohortData.plan_id
        if (!planId) throw new Error("No plan assigned to cohort.")

        const planSnap = await getDoc(doc(db, "plans", planId))
        if (!planSnap.exists()) throw new Error("Plan not found.")
        setPlan({ id: planSnap.id, ...planSnap.data() })

        // tracks
        const tracksSnap = await getDocs(
          query(collection(db, "tracks"), where("plan_id", "==", planId), orderBy("order"))
        )
        const tracksData = tracksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTracks(tracksData)

        // modules for all tracks
        if (tracksData.length > 0) {
          const trackIds = tracksData.map((t) => t.id)
          // Firestore "in" max 30
          const chunked = []
          for (let i = 0; i < trackIds.length; i += 10) {
            chunked.push(trackIds.slice(i, i + 10))
          }
          const allModules = []
          for (const chunk of chunked) {
            const snap = await getDocs(
              query(collection(db, "modules"), where("track_id", "in", chunk), orderBy("order"))
            )
            allModules.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          }
          setModules(allModules)

          // milestones
          if (allModules.length > 0) {
            const modIds = allModules.map((m) => m.id)
            const allMilestones = []
            for (let i = 0; i < modIds.length; i += 10) {
              const chunk = modIds.slice(i, i + 10)
              const snap = await getDocs(
                query(collection(db, "milestones"), where("module_id", "in", chunk), orderBy("week_number"))
              )
              allMilestones.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            }
            setMilestones(allMilestones)

            // tasks
            if (allMilestones.length > 0) {
              const msIds = allMilestones.map((m) => m.id)
              const allTasks = []
              for (let i = 0; i < msIds.length; i += 10) {
                const chunk = msIds.slice(i, i + 10)
                const snap = await getDocs(
                  query(collection(db, "tasks"), where("milestone_id", "in", chunk), orderBy("order"))
                )
                allTasks.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
              }
              setTasks(allTasks)

              // outcomes for this user
              if (allTasks.length > 0) {
                const taskIds = allTasks.map((t) => t.id)
                const allOutcomes = []
                for (let i = 0; i < taskIds.length; i += 10) {
                  const chunk = taskIds.slice(i, i + 10)
                  const snap = await getDocs(
                    query(
                      collection(db, "outcomes"),
                      where("user_id", "==", user.uid),
                      where("task_id", "in", chunk)
                    )
                  )
                  allOutcomes.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
                }
                const map = {}
                allOutcomes.forEach((o) => { map[o.task_id] = o })
                setOutcomes(map)
              }
            }
          }
        }

        // Auto-expand first track
        if (tracksData.length > 0) {
          setExpandedTracks({ [tracksData[0].id]: true })
        }
      } catch (err) {
        console.error(err)
        setError(err.message)
      }
      setLoading(false)
    }
    load()
  }, [userDoc, user?.uid])

  // Milestone lock logic: milestone N is locked if milestone N-1 (by week_number) is not completed
  function isMilestoneLocked(milestone, moduleId) {
    const milestoneStatus = progressDoc?.milestone_status ?? {}
    const moduleMilestones = milestones
      .filter((m) => m.module_id === moduleId)
      .sort((a, b) => a.week_number - b.week_number)
    const idx = moduleMilestones.findIndex((m) => m.id === milestone.id)
    if (idx === 0) return false
    const prev = moduleMilestones[idx - 1]
    return milestoneStatus[prev.id] !== "completed"
  }

  const toggle = (setter, id) =>
    setter((prev) => ({ ...prev, [id]: !prev[id] }))

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/3" />
        </div>
        <Skeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm mt-1">Please contact your trainer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const milestoneStatus = progressDoc?.milestone_status ?? {}
  const completedTasks = progressDoc?.completed_tasks ?? []

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Plan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {plan?.name} &middot; {cohort?.duration_weeks ?? "—"} weeks
            </p>
          </div>
        </div>
      </div>
    <div className="p-6 space-y-6">

      {/* Overall progress */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-primary font-semibold">{Math.round(progressDoc?.overall_pct ?? 0)}%</span>
          </div>
          <Progress value={progressDoc?.overall_pct ?? 0} className="h-2" />
        </CardContent>
      </Card>

      {/* Tracks accordion */}
      <div className="space-y-3">
        {tracks.map((track) => {
          const trackModules = modules.filter((m) => m.track_id === track.id)
          const trackMilestones = milestones.filter((ms) =>
            trackModules.some((m) => m.id === ms.module_id)
          )
          const trackTasks = tasks.filter((t) =>
            trackMilestones.some((ms) => ms.id === t.milestone_id)
          )
          const trackPct = progressDoc?.track_pct?.[track.id] ?? 0

          return (
            <Card key={track.id} className="overflow-hidden">
              <Collapsible
                open={!!expandedTracks[track.id]}
                onOpenChange={() => toggle(setExpandedTracks, track.id)}
              >
                {/* Track header */}
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center gap-3 p-4 h-auto text-left hover:bg-accent/50 transition-colors justify-start rounded-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{track.label}</span>
                        {track.category && (
                          <Badge variant="outline" className="text-xs">{track.category}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Progress value={trackPct} className="h-1.5 flex-1 max-w-xs" />
                        <span className="text-xs text-muted-foreground">{Math.round(trackPct)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{trackTasks.length} tasks</span>
                      {expandedTracks[track.id]
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </Button>
                </CollapsibleTrigger>

                {/* Modules */}
                <CollapsibleContent>
                  <div className="border-t border-border">
                    {trackModules.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-4 py-3">No modules yet.</p>
                    ) : (
                      trackModules.map((mod) => {
                        const modMilestones = milestones
                          .filter((ms) => ms.module_id === mod.id)
                          .sort((a, b) => a.week_number - b.week_number)
                        const modSchedule = cohort?.module_schedule?.[mod.id]

                        return (
                          <div key={mod.id} className="border-b border-border last:border-b-0">
                            <Collapsible
                              open={!!expandedModules[mod.id]}
                              onOpenChange={() => toggle(setExpandedModules, mod.id)}
                            >
                              {/* Module header */}
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full flex items-center gap-3 px-6 py-3 h-auto text-left hover:bg-accent/30 transition-colors justify-start rounded-none"
                                >
                                  <div className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
                                  <span className="flex-1 text-sm font-medium">{mod.title}</span>
                                  {modSchedule && (
                                    <Badge variant="secondary" className="text-xs">
                                      Week {modSchedule.start_week}
                                      {modSchedule.weeks > 1 ? `–${modSchedule.start_week + modSchedule.weeks - 1}` : ""}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground mr-2">
                                    {modMilestones.length} milestone{modMilestones.length !== 1 ? "s" : ""}
                                  </span>
                                  {expandedModules[mod.id]
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                </Button>
                              </CollapsibleTrigger>

                              {/* Milestones */}
                              <CollapsibleContent>
                                <div className="pl-12 pr-4 pb-2 space-y-2">
                                  {modMilestones.map((ms) => {
                                    const locked = isMilestoneLocked(ms, mod.id)
                                    const mStatus = milestoneStatus[ms.id] || "not_started"
                                    const msTasks = tasks.filter((t) => t.milestone_id === ms.id)
                                    const completionPct = milestoneCompletionPct(ms.id, tasks, completedTasks)

                                    return (
                                      <div
                                        key={ms.id}
                                        className={cn(
                                          "rounded-lg border",
                                          locked ? "opacity-60 bg-muted/30" : "bg-card"
                                        )}
                                      >
                                        <Collapsible
                                          open={!!expandedMilestones[ms.id] && !locked}
                                          onOpenChange={() => !locked && toggle(setExpandedMilestones, ms.id)}
                                          disabled={locked}
                                        >
                                          {/* Milestone header */}
                                          <CollapsibleTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              disabled={locked}
                                              className="w-full flex items-center gap-2 p-3 h-auto text-left justify-start rounded-lg"
                                            >
                                              {locked
                                                ? <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                : mStatus === "completed"
                                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                  : mStatus === "in_progress"
                                                    ? <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                                                    : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                              }
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="text-sm font-medium">{ms.title}</span>
                                                  <Badge variant="outline" className="text-xs shrink-0">
                                                    Week {ms.week_number}
                                                  </Badge>
                                                </div>
                                                {!locked && (
                                                  <div className="flex items-center gap-2 mt-1">
                                                    <Progress value={completionPct} className="h-1 flex-1" />
                                                    <span className="text-xs text-muted-foreground">{completionPct}%</span>
                                                  </div>
                                                )}
                                              </div>
                                              {!locked && (
                                                expandedMilestones[ms.id]
                                                  ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                                  : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                              )}
                                            </Button>
                                          </CollapsibleTrigger>

                                          {/* Tasks */}
                                          <CollapsibleContent>
                                            {!locked && (
                                              <div className="border-t border-border px-3 pb-2 pt-1 space-y-1">
                                                {msTasks.length === 0 ? (
                                                  <p className="text-xs text-muted-foreground py-2">No tasks.</p>
                                                ) : (
                                                  msTasks.map((task) => {
                                                    const outcome = outcomes[task.id]
                                                    const taskStatus = outcome?.status || "not_started"
                                                    const taskLocked = locked

                                                    return (
                                                      <Button
                                                        key={task.id}
                                                        variant="ghost"
                                                        disabled={taskLocked}
                                                        onClick={() => !taskLocked && navigate(`/intern/tasks/${task.id}`)}
                                                        className={cn(
                                                          "w-full flex items-center gap-2.5 rounded-md px-2 py-2 h-auto text-left text-sm transition-colors justify-start",
                                                          taskLocked
                                                            ? "cursor-not-allowed opacity-50"
                                                            : "hover:bg-accent cursor-pointer"
                                                        )}
                                                      >
                                                        <TaskStatusIndicator status={taskStatus} locked={taskLocked} />
                                                        <span className="flex-1 truncate text-xs">{task.title}</span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                          {taskTypeIcon(task.type)}
                                                          <Badge
                                                            variant={taskTypeVariant(task.type)}
                                                            className="text-xs px-1.5 py-0 h-4"
                                                          >
                                                            {task.type}
                                                          </Badge>
                                                        </div>
                                                      </Button>
                                                    )
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </CollapsibleContent>
                                        </Collapsible>
                                      </div>
                                    )
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>
    </div>
    </div>
  )
}
