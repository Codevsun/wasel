import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  Zap, Briefcase, BookOpen, FlaskConical, Upload, FileText,
  CheckCircle2, Clock, ChevronRight, CalendarDays, MessageSquare,
} from "lucide-react"

// ─── helpers ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  reading:    { icon: BookOpen,    label: "Reading",    color: "text-blue-500",   bg: "bg-blue-500/10"    },
  lab:        { icon: FlaskConical, label: "Lab",       color: "text-purple-500", bg: "bg-purple-500/10"  },
  submission: { icon: Upload,      label: "Submission", color: "text-green-500",  bg: "bg-green-500/10"   },
  quiz:       { icon: FileText,    label: "Quiz",       color: "text-amber-500",  bg: "bg-amber-500/10"   },
}

const STATUS_CONFIG = {
  not_started: { label: "To Do",       variant: "outline",     dot: "bg-muted-foreground" },
  in_progress: { label: "In Progress", variant: "warning",     dot: "bg-amber-500"        },
  submitted:   { label: "Submitted",   variant: "secondary",   dot: "bg-blue-500"         },
  reviewed:    { label: "Reviewed",    variant: "secondary",   dot: "bg-blue-500"         },
  passed:      { label: "Approved",    variant: "success",     dot: "bg-green-500"        },
  approved:    { label: "Approved",    variant: "success",     dot: "bg-green-500"        },
  failed:      { label: "Rejected",    variant: "destructive", dot: "bg-red-500"          },
}

function formatDate(ts) {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── main component ───────────────────────────────────────────────────────────

export default function InternTasks() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [outcomes, setOutcomes] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    const q = query(collection(db, "tasks"), where("assigned_to", "==", user.uid))
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
      setTasks(list)
      setLoading(false)

      if (!list.length) return
      const ids = list.map((t) => t.id)
      const oSnap = await getDocs(query(
        collection(db, "outcomes"),
        where("user_id", "==", user.uid),
        where("task_id", "in", ids)
      ))
      const map = {}
      oSnap.docs.forEach((d) => { map[d.data().task_id] = d.data() })
      setOutcomes(map)
    }, console.error)

    return unsub
  }, [user?.uid])

  const quickTasks   = tasks.filter((t) => t.is_quick)
  const fullProjects = tasks.filter((t) => !t.is_quick)

  const countDone = (list) =>
    list.filter((t) => {
      const s = outcomes[t.id]?.status
      return s === "passed" || s === "approved"
    }).length

  return (
    <div className="min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tasks and projects assigned to you by your trainer
            </p>
          </div>
          {!loading && tasks.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold text-primary">
                  {countDone(tasks)} / {tasks.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Briefcase className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-base font-medium">No tasks yet</p>
            <p className="text-sm mt-1">Your trainer hasn't assigned any tasks yet.</p>
          </div>
        ) : (
          <>
            {/* ── Quick Tasks ──────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Quick Tasks
                    </CardTitle>
                  </div>
                  {quickTasks.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {countDone(quickTasks)}/{quickTasks.length} done
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {quickTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No quick tasks assigned yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {quickTasks.map((task) => {
                      const outcome = outcomes[task.id]
                      const status  = outcome?.status || "not_started"
                      const isDone  = status === "passed" || status === "approved"
                      const cfg     = TYPE_CONFIG[task.type] || TYPE_CONFIG.reading
                      const Icon    = cfg.icon

                      return (
                        <button
                          key={task.id}
                          onClick={() => navigate(`/intern/tasks/${task.id}`)}
                          className="group w-full flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-accent/40 -mx-1 px-1 rounded-lg"
                        >
                          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
                            {isDone
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                            }
                          </div>
                          <span className={cn(
                            "flex-1 text-sm min-w-0 truncate",
                            isDone && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {status !== "not_started" && (
                              <Badge
                                variant={STATUS_CONFIG[status]?.variant || "outline"}
                                className="text-xs capitalize"
                              >
                                {STATUS_CONFIG[status]?.label || status}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Projects ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Projects
                    </CardTitle>
                  </div>
                  {fullProjects.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {countDone(fullProjects)}/{fullProjects.length} done
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {fullProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No projects assigned yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {fullProjects.map((project) => {
                      const outcome    = outcomes[project.id]
                      const status     = outcome?.status || "not_started"
                      const statusCfg  = STATUS_CONFIG[status] || STATUS_CONFIG.not_started
                      const typeCfg    = TYPE_CONFIG[project.type] || TYPE_CONFIG.reading
                      const TypeIcon   = typeCfg.icon
                      const isDone     = status === "passed" || status === "approved"
                      const displayLabel = "Project"

                      return (
                        <button
                          key={project.id}
                          onClick={() => navigate(`/intern/tasks/${project.id}`)}
                          className="group w-full flex items-start gap-4 py-4 text-left transition-colors hover:bg-accent/40 -mx-1 px-1 rounded-lg"
                        >
                          {/* Icon */}
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5",
                            isDone ? "bg-green-500/10" : typeCfg.bg
                          )}>
                            {isDone
                              ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                              : <TypeIcon className={cn("h-5 w-5", typeCfg.color)} />
                            }
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Title + badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-sm font-semibold",
                                isDone && "line-through text-muted-foreground"
                              )}>
                                {project.title}
                              </span>
                              <Badge variant="outline" className="text-xs">{displayLabel}</Badge>
                              <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
                            </div>

                            {/* Full description */}
                            {project.content && (
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {project.content}
                              </p>
                            )}

                            {/* Meta row */}
                            <div className="flex items-center gap-3 pt-0.5">
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
                              {outcome?.feedback && (
                                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                  <MessageSquare className="h-3 w-3" />
                                  Trainer feedback
                                </span>
                              )}
                            </div>

                            {/* Feedback preview */}
                            {outcome?.feedback && (
                              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 mt-1">
                                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                  "{outcome.feedback}"
                                </p>
                              </div>
                            )}
                          </div>

                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
