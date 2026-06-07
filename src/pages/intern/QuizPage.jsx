import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  doc, getDoc, getDocs, addDoc, updateDoc, query, collection,
  where, serverTimestamp,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { markTaskCompleted } from "../../lib/progress"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Separator } from "../../components/ui/separator"
import { cn } from "../../lib/utils"
import {
  CheckCircle2, XCircle, ArrowLeft, ArrowRight, HelpCircle,
  AlertCircle, RefreshCw, Trophy, Clock,
} from "lucide-react"

// ─── helpers ─────────────────────────────────────────────────────────────────

async function upsertOutcome(uid, taskId, patch) {
  const q = query(collection(db, "outcomes"), where("user_id", "==", uid), where("task_id", "==", taskId))
  const snap = await getDocs(q)
  if (snap.empty) {
    return addDoc(collection(db, "outcomes"), {
      user_id: uid,
      task_id: taskId,
      status: "not_started",
      ...patch,
    })
  } else {
    return updateDoc(snap.docs[0].ref, patch)
  }
}

// ─── result screen ────────────────────────────────────────────────────────────

function ResultScreen({ quiz, answers, score, passed, attempt, onRetry, onBack }) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back to Task
      </Button>

      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-4">
          {passed ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <Trophy className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Congratulations!</h2>
              <p className="text-muted-foreground">You passed the quiz.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-destructive">Not Quite</h2>
              <p className="text-muted-foreground">You didn't reach the passing score this time.</p>
            </div>
          )}

          <div className="flex items-center gap-8 mt-2">
            <div className="text-center">
              <p className="text-3xl font-bold">{Math.round(score)}%</p>
              <p className="text-xs text-muted-foreground">Your Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-muted-foreground">{quiz.passing_score}%</p>
              <p className="text-xs text-muted-foreground">Passing Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-muted-foreground">#{attempt}</p>
              <p className="text-xs text-muted-foreground">Attempt</p>
            </div>
          </div>
        </CardContent>

        <Separator />

        {/* Answer review */}
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Answer Review</h3>
          {quiz.questions.map((q, idx) => {
            const selected = answers[q.id]
            const correct = q.correct_index
            const isCorrect = selected === correct

            return (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  {isCorrect
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  }
                  <span className="text-sm font-medium">{idx + 1}. {q.question}</span>
                </div>
                <div className="pl-6 space-y-1">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selected === optIdx
                    const isCorrectOpt = optIdx === correct
                    return (
                      <div
                        key={optIdx}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm flex items-center gap-2",
                          isCorrectOpt ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium" :
                          isSelected && !isCorrectOpt ? "bg-destructive/10 text-destructive" :
                          "text-muted-foreground"
                        )}
                      >
                        {isCorrectOpt && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                        {isSelected && !isCorrectOpt && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        {!isCorrectOpt && !isSelected && <div className="h-3.5 w-3.5 shrink-0" />}
                        {opt}
                      </div>
                    )
                  })}
                </div>
                {idx < quiz.questions.length - 1 && <Separator />}
              </div>
            )
          })}
        </CardContent>

        <CardFooter className="gap-3 flex-wrap">
          {!passed && (
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button variant="outline" onClick={onBack}>
            {passed ? "Back to Task" : "Return to Task"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function QuizPage() {
  const { taskId } = useParams()
  const { user, userDoc } = useAuth()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Quiz state
  const [answers, setAnswers] = useState({}) // questionId → optionIndex
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null) // { score, passed, attempt }

  const loadQuiz = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSubmitted(false)
    setResult(null)
    setAnswers({})
    setCurrentQIdx(0)
    try {
      const snap = await getDoc(doc(db, "quizzes", taskId))
      if (!snap.exists()) throw new Error("Quiz not found for this task.")
      setQuiz({ id: snap.id, ...snap.data() })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadQuiz() }, [loadQuiz])

  const handleSelect = (questionId, optionIdx) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleSubmit = async () => {
    if (!quiz || !user?.uid) return
    setSubmitting(true)
    try {
      // Calculate score
      const total = quiz.questions.length
      let correct = 0
      quiz.questions.forEach((q) => {
        if (answers[q.id] === q.correct_index) correct++
      })
      const score = total > 0 ? Math.round((correct / total) * 100) : 0
      const passed = score >= quiz.passing_score

      // Get previous attempt count
      const prevSnap = await getDocs(
        query(collection(db, "quiz_results"), where("user_id", "==", user.uid), where("task_id", "==", taskId))
      )
      const attempt = prevSnap.size + 1

      // Write quiz_results
      await addDoc(collection(db, "quiz_results"), {
        task_id: taskId,
        user_id: user.uid,
        answers,
        score,
        passed,
        attempt,
        taken_at: serverTimestamp(),
      })

      // Update outcome
      await upsertOutcome(user.uid, taskId, {
        status: passed ? "passed" : "failed",
        score,
        submitted_at: serverTimestamp(),
      })

      // Update progress if passed
      if (passed) {
        await markTaskCompleted(user.uid, taskId, {
          cohortId: userDoc?.cohort_ids?.[0],
        })
      }

      setResult({ score, passed, attempt })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const allAnswered = quiz?.questions.every((q) => answers[q.id] != null)
  const currentQ = quiz?.questions[currentQIdx]
  const progress = quiz ? ((currentQIdx + 1) / quiz.questions.length) * 100 : 0
  const answeredCount = Object.keys(answers).length

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl animate-pulse">
        <div className="h-5 bg-muted rounded w-1/4" />
        <div className="h-8 bg-muted rounded w-1/2" />
        <div className="h-48 bg-muted rounded" />
      </div>
    )
  }

  if (error && !quiz) {
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

  // Result screen
  if (submitted && result) {
    return (
      <ResultScreen
        quiz={quiz}
        answers={answers}
        score={result.score}
        passed={result.passed}
        attempt={result.attempt}
        onRetry={loadQuiz}
        onBack={() => navigate(`/intern/tasks/${taskId}`)}
      />
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(`/intern/tasks/${taskId}`)}>
        <ArrowLeft className="h-4 w-4" />
        Back to Task
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-yellow-500" />
          <h1 className="text-2xl font-bold">Quiz</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {quiz.questions.length} questions &middot; Passing score: {quiz.passing_score}%
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {currentQIdx + 1} of {quiz.questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={(answeredCount / quiz.questions.length) * 100} className="h-2" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">Q{currentQIdx + 1}</Badge>
            <CardTitle className="text-base font-medium leading-relaxed">
              {currentQ.question}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = answers[currentQ.id] === idx
            return (
              <button
                key={idx}
                onClick={() => handleSelect(currentQ.id, idx)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "hover:border-border/80 hover:bg-accent"
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                </div>
                <span>{opt}</span>
              </button>
            )
          })}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentQIdx((p) => Math.max(0, p - 1))}
              disabled={currentQIdx === 0}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            {currentQIdx < quiz.questions.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentQIdx((p) => p + 1)}
                className="gap-1.5"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {/* Jump to any question */}
          <div className="flex items-center gap-1 flex-wrap">
            {quiz.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQIdx(idx)}
                className={cn(
                  "h-7 w-7 rounded-md text-xs font-medium transition-colors border",
                  idx === currentQIdx
                    ? "bg-primary text-primary-foreground border-primary"
                    : answers[q.id] != null
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-transparent text-muted-foreground"
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </CardFooter>
      </Card>

      {/* Submit */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {quiz.questions.length} questions answered
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          size="lg"
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Quiz"}
        </Button>
      </div>
    </div>
  )
}
