import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, getDocs, query, collection, where,
  addDoc, updateDoc, setDoc, serverTimestamp, increment,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Separator } from "../../components/ui/separator"
import { cn } from "../../lib/utils"
import {
  CheckCircle2, Clock, AlertCircle, ArrowLeft, BookOpen,
  FlaskConical, HelpCircle, Upload, ExternalLink, MessageSquare,
  RefreshCw,
} from "lucide-react"

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  reading: { icon: BookOpen, label: "Reading", variant: "secondary", color: "text-blue-500" },
  lab: { icon: FlaskConical, label: "Lab", variant: "default", color: "text-purple-500" },
  quiz: { icon: HelpCircle, label: "Quiz", variant: "warning", color: "text-yellow-500" },
  submission: { icon: Upload, label: "Submission", variant: "outline", color: "text-green-500" },
}

function StatusBadge({ status }) {
  const map = {
    not_started: { label: "Not Started", variant: "outline" },
    in_progress: { label: "In Progress", variant: "warning" },
    submitted: { label: "Submitted", variant: "secondary" },
    reviewed: { label: "Reviewed", variant: "default" },
    passed: { label: "Passed", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
  }
  const cfg = map[status] || { label: status, variant: "outline" }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function FeedbackBlock({ outcome }) {
  if (!outcome?.feedback) return null
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-1",
      outcome.status === "passed" ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
    )}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Trainer Feedback</span>
        {outcome.score != null && (
          <Badge variant="outline" className="ml-auto">Score: {outcome.score}%</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{outcome.feedback}</p>
    </div>
  )
}

// ─── submission update helper ────────────────────────────────────────────────

async function upsertOutcome(uid, taskId, patch) {
  const q = query(collection(db, "outcomes"), where("user_id", "==", uid), where("task_id", "==", taskId))
  const snap = await getDocs(q)
  if (snap.empty) {
    return addDoc(collection(db, "outcomes"), {
      user_id: uid,
      task_id: taskId,
      status: "not_started",
      submitted_at: null,
      ...patch,
    })
  } else {
    return updateDoc(snap.docs[0].ref, patch)
  }
}

async function updateProgressCompleted(uid, taskId) {
  const progRef = doc(db, "progress", uid)
  const progSnap = await getDoc(progRef)
  if (progSnap.exists()) {
    const data = progSnap.data()
    const completed = Array.from(new Set([...(data.completed_tasks || []), taskId]))
    const totalTasks = data.total_tasks || 1
    await updateDoc(progRef, {
      completed_tasks: completed,
      overall_pct: Math.min(100, Math.round((completed.length / totalTasks) * 100)),
      last_active: serverTimestamp(),
    })
  }
}

// ─── main component ──────────────────────────────────────────────────────────

export default function TaskPage() {
  const { taskId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // form state
  const [linkValue, setLinkValue] = useState("")
  const [textValue, setTextValue] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const taskSnap = await getDoc(doc(db, "tasks", taskId))
      if (!taskSnap.exists()) throw new Error("Task not found.")
      const taskData = { id: taskSnap.id, ...taskSnap.data() }
      setTask(taskData)

      if (user?.uid) {
        const q = query(
          collection(db, "outcomes"),
          where("user_id", "==", user.uid),
          where("task_id", "==", taskId)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const o = { id: snap.docs[0].id, ...snap.docs[0].data() }
          setOutcome(o)
          setLinkValue(o.link || "")
          setTextValue(o.content || "")
        }
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [taskId, user?.uid])

  useEffect(() => { loadData() }, [loadData])

  // ── Reading task ────────────────────────────────────────────────────────────
  const handleMarkComplete = async () => {
    setSubmitting(true)
    try {
      await upsertOutcome(user.uid, taskId, {
        status: "passed",
        submitted_at: serverTimestamp(),
      })
      await updateProgressCompleted(user.uid, taskId)
      setSuccess(true)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  // ── Lab task ────────────────────────────────────────────────────────────────
  const handleLabSubmit = async () => {
    if (!linkValue.trim()) return
    setSubmitting(true)
    try {
      const subRef = await addDoc(collection(db, "submissions"), {
        outcome_id: null,
        user_id: user.uid,
        task_id: taskId,
        type: "link",
        link: linkValue.trim(),
        submitted_at: serverTimestamp(),
        status: "submitted",
        trainer_feedback: null,
        version: 1,
      })
      await upsertOutcome(user.uid, taskId, {
        status: "submitted",
        link: linkValue.trim(),
        submitted_at: serverTimestamp(),
      })
      setSuccess(true)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  // ── Submission task ─────────────────────────────────────────────────────────
  const handleSubmissionSubmit = async () => {
    if (!textValue.trim() && !linkValue.trim()) return
    setSubmitting(true)
    try {
      // Find previous submission version
      const prevSnap = await getDocs(
        query(collection(db, "submissions"), where("user_id", "==", user.uid), where("task_id", "==", taskId))
      )
      const version = prevSnap.size + 1

      await addDoc(collection(db, "submissions"), {
        outcome_id: null,
        user_id: user.uid,
        task_id: taskId,
        type: textValue.trim() ? "text" : "link",
        content: textValue.trim() || null,
        link: linkValue.trim() || null,
        submitted_at: serverTimestamp(),
        status: "submitted",
        trainer_feedback: null,
        version,
      })
      await upsertOutcome(user.uid, taskId, {
        status: "submitted",
        content: textValue.trim() || null,
        link: linkValue.trim() || null,
        submitted_at: serverTimestamp(),
      })
      setSuccess(true)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3" />
        <div className="h-8 bg-muted rounded w-2/3" />
        <div className="h-40 bg-muted rounded" />
      </div>
    )
  }

  if (error && !task) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const typeConfig = TYPE_CONFIG[task.type] || TYPE_CONFIG.reading
  const TypeIcon = typeConfig.icon
  const isCompleted = outcome?.status === "passed"
  const isFailed = outcome?.status === "failed"
  const isSubmitted = ["submitted", "reviewed"].includes(outcome?.status)
  const canResubmit = isFailed
  const currentStatus = outcome?.status || "not_started"

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back to Plan
      </Button>

      {/* Task card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3 flex-wrap">
            <div className={cn("rounded-md p-2 bg-muted mt-0.5", typeConfig.color)}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                <StatusBadge status={currentStatus} />
              </div>
              <CardTitle className="text-xl">{task.title}</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Content */}
          {task.content && (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {task.content}
              </p>
            </div>
          )}

          {/* Feedback */}
          <FeedbackBlock outcome={outcome} />

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-400">Submitted successfully!</p>
            </div>
          )}

          <Separator />

          {/* ── Reading ── */}
          {task.type === "reading" && (
            <div className="space-y-3">
              {isCompleted ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Completed</span>
                </div>
              ) : (
                <Button onClick={handleMarkComplete} disabled={submitting} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Marking..." : "Mark as Complete"}
                </Button>
              )}
            </div>
          )}

          {/* ── Lab ── */}
          {task.type === "lab" && !isSubmitted && !isCompleted && (
            <div className="space-y-3">
              <Label htmlFor="lab-link">Repository or Demo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="lab-link"
                  placeholder="https://github.com/..."
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleLabSubmit} disabled={submitting || !linkValue.trim()} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )}
          {task.type === "lab" && (isSubmitted || isCompleted) && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Submitted URL:</p>
              <a
                href={outcome?.link || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline underline-offset-4 flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {outcome?.link}
              </a>
            </div>
          )}

          {/* ── Quiz ── */}
          {task.type === "quiz" && (
            <div className="space-y-3">
              {isCompleted ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Quiz Passed</span>
                </div>
              ) : isFailed ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Quiz Failed — Score: {outcome?.score ?? 0}%</span>
                  </div>
                  <Button onClick={() => navigate(`/intern/quiz/${taskId}`)} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              ) : isSubmitted ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  <span>Quiz submitted, awaiting review.</span>
                </div>
              ) : (
                <Button onClick={() => navigate(`/intern/quiz/${taskId}`)} className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Take Quiz
                </Button>
              )}
            </div>
          )}

          {/* ── Submission ── */}
          {task.type === "submission" && (
            <div className="space-y-4">
              {(isCompleted || (isSubmitted && !canResubmit)) ? (
                <div className="space-y-3">
                  <div className={cn("flex items-center gap-2", isCompleted ? "text-green-500" : "text-muted-foreground")}>
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    <span className="font-medium">{isCompleted ? "Passed" : "Submitted — Pending Review"}</span>
                  </div>
                  {outcome?.content && (
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Your submission:</p>
                      <p className="text-sm whitespace-pre-wrap">{outcome.content}</p>
                    </div>
                  )}
                  {outcome?.link && (
                    <a
                      href={outcome.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline underline-offset-4 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {outcome.link}
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {canResubmit && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive">
                        Your submission was not accepted. Please revise and resubmit.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="sub-text">Written Response</Label>
                    <Textarea
                      id="sub-text"
                      placeholder="Write your response here..."
                      rows={5}
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub-link">Or attach a link (optional)</Label>
                    <Input
                      id="sub-link"
                      placeholder="https://..."
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                    />
                  </div>
                  <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground">
                    <Upload className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs">File upload coming soon</p>
                  </div>
                  <Button
                    onClick={handleSubmissionSubmit}
                    disabled={submitting || (!textValue.trim() && !linkValue.trim())}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {submitting ? "Submitting..." : canResubmit ? "Resubmit" : "Submit"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
