import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, getDocs, query, collection, where,
  updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "../../components/ui/tabs"
import {
  ArrowLeft, CheckCircle2, XCircle, Link2, FileText, Download,
  Clock, User, BookOpen, AlertTriangle, History,
} from "lucide-react"
import { cn } from "../../lib/utils"

function formatDate(ts) {
  if (!ts) return "—"
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const STATUS_VARIANT = {
  approved: "success",
  rejected: "destructive",
  pending: "warning",
  submitted: "secondary",
}

export default function ReviewPage() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [submission, setSubmission] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [task, setTask] = useState(null)
  const [intern, setIntern] = useState(null)
  const [allVersions, setAllVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        // Load submission
        const subSnap = await getDoc(doc(db, "submissions", submissionId))
        if (!subSnap.exists() || !active) return
        const sub = { id: subSnap.id, ...subSnap.data() }
        setSubmission(sub)
        setFeedback(sub.trainer_feedback || "")

        // Load all versions (same task_id + user_id)
        if (sub.task_id && sub.user_id) {
          const versionsQ = query(
            collection(db, "submissions"),
            where("task_id", "==", sub.task_id),
            where("user_id", "==", sub.user_id)
          )
          const vSnap = await getDocs(versionsQ)
          const versions = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          versions.sort((a, b) => (b.version || 1) - (a.version || 1))
          if (active) setAllVersions(versions)
        }

        // Load outcome
        if (sub.outcome_id) {
          const outSnap = await getDoc(doc(db, "outcomes", sub.outcome_id))
          if (outSnap.exists() && active) setOutcome({ id: outSnap.id, ...outSnap.data() })
        } else if (sub.task_id && sub.user_id) {
          // Try to find outcome by task_id + user_id
          const outQ = query(
            collection(db, "outcomes"),
            where("task_id", "==", sub.task_id),
            where("user_id", "==", sub.user_id)
          )
          const outSnap = await getDocs(outQ)
          if (!outSnap.empty && active) {
            setOutcome({ id: outSnap.docs[0].id, ...outSnap.docs[0].data() })
          }
        }

        // Load task
        if (sub.task_id) {
          const taskSnap = await getDoc(doc(db, "tasks", sub.task_id))
          if (taskSnap.exists() && active) setTask({ id: taskSnap.id, ...taskSnap.data() })
        }

        // Load intern
        if (sub.user_id) {
          const userSnap = await getDoc(doc(db, "users", sub.user_id))
          if (userSnap.exists() && active) setIntern({ id: userSnap.id, ...userSnap.data() })
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [submissionId])

  const handleReview = async (status) => {
    if (!submission) return
    setSubmitting(true)
    try {
      const now = serverTimestamp()

      // Update submission
      await updateDoc(doc(db, "submissions", submissionId), {
        status,
        trainer_feedback: feedback,
      })

      // Update or create outcome
      if (outcome?.id) {
        await updateDoc(doc(db, "outcomes", outcome.id), {
          status,
          feedback,
          reviewed_by: user?.uid,
          reviewed_at: now,
        })
      } else if (submission.task_id && submission.user_id) {
        await addDoc(collection(db, "outcomes"), {
          task_id: submission.task_id,
          user_id: submission.user_id,
          status,
          feedback,
          reviewed_by: user?.uid,
          reviewed_at: now,
          submitted_at: submission.submitted_at,
        })
      }

      navigate(-1)
    } catch (err) {
      console.error(err)
      alert("Failed to submit review: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isImage = (url) => url && /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url)
  const isPDF = (url) => url && /\.pdf(\?|$)/i.test(url)

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium">Submission not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/trainer/reviews")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Review Queue
        </Button>
      </div>
    )
  }

  const initials = intern?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
  const alreadyReviewed = submission.status === "approved" || submission.status === "rejected"

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/trainer/reviews")}>
        <ArrowLeft className="h-4 w-4" />
        Review Queue
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{intern?.name || "Unknown Intern"}</h1>
            <p className="text-sm text-muted-foreground">{intern?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[submission.status] || "outline"} className="capitalize">
            {submission.status || "pending"}
          </Badge>
          {submission.version > 1 && (
            <Badge variant="secondary">Version {submission.version}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task + Submission */}
        <div className="lg:col-span-2 space-y-4">
          {/* Task Info */}
          {task && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Task</CardTitle>
                  <Badge variant="outline" className="capitalize text-xs ml-auto">{task.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold mb-2">{task.title}</h3>
                {task.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.content}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submission Content */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Submission</CardTitle>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(submission.submitted_at)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Text content */}
              {submission.content && (
                <div className="rounded-md bg-muted/50 p-4">
                  <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                </div>
              )}

              {/* Link */}
              {submission.link && (
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={submission.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {submission.link}
                  </a>
                </div>
              )}

              {/* File */}
              {submission.file_url && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View / Download File
                    </a>
                  </div>

                  {/* Preview */}
                  {isImage(submission.file_url) && (
                    <img
                      src={submission.file_url}
                      alt="Submission"
                      className="max-w-full rounded-md border border-border max-h-96 object-contain"
                    />
                  )}
                  {isPDF(submission.file_url) && (
                    <iframe
                      src={submission.file_url}
                      className="w-full h-96 rounded-md border border-border"
                      title="Submission PDF"
                    />
                  )}
                </div>
              )}

              {!submission.content && !submission.link && !submission.file_url && (
                <p className="text-sm text-muted-foreground italic">No content submitted.</p>
              )}
            </CardContent>
          </Card>

          {/* Version History */}
          {allVersions.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Version History</CardTitle>
                  <Badge variant="secondary" className="ml-auto text-xs">{allVersions.length} versions</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allVersions.map((v) => (
                    <button
                      key={v.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-md border transition-colors text-left",
                        v.id === submissionId
                          ? "border-primary/30 bg-primary/5"
                          : "border-border hover:bg-accent"
                      )}
                      onClick={() => {
                        if (v.id !== submissionId) navigate(`/trainer/reviews/${v.id}`)
                      }}
                    >
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        v.status === "approved" ? "bg-green-500" :
                        v.status === "rejected" ? "bg-red-500" : "bg-amber-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Version {v.version || 1}
                          {v.id === submissionId && (
                            <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(v.submitted_at)}</p>
                      </div>
                      <Badge
                        variant={STATUS_VARIANT[v.status] || "outline"}
                        className="text-xs capitalize"
                      >
                        {v.status || "pending"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Review Panel */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Review</CardTitle>
              {alreadyReviewed && (
                <CardDescription>
                  This submission has already been reviewed.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing feedback */}
              {outcome?.feedback && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Previous feedback</p>
                  <p className="text-sm">{outcome.feedback}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Write constructive feedback for the intern..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleReview("approved")}
                  disabled={submitting}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Saving..." : "Pass"}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleReview("rejected")}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4" />
                  {submitting ? "Saving..." : "Fail"}
                </Button>
              </div>

              {outcome?.reviewed_at && (
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Reviewed: {formatDate(outcome.reviewed_at)}
                  </p>
                  {outcome.score !== undefined && outcome.score !== null && (
                    <p className="text-xs text-muted-foreground">
                      Score: <span className="font-medium">{outcome.score}%</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Intern Info */}
          {intern && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Intern Info</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={intern.status === "active" ? "success" : "secondary"} className="capitalize text-xs">
                    {intern.status || "unknown"}
                  </Badge>
                </div>
                {intern.track_preference?.length > 0 && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground shrink-0">Tracks</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {intern.track_preference.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/trainer/interns/${intern.id}`)}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
