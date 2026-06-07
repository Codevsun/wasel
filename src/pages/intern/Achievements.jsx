import { useEffect, useState } from "react"
import {
  doc, getDoc, getDocs, query, collection, where, orderBy,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Progress } from "../../components/ui/progress"
import { Separator } from "../../components/ui/separator"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { cn } from "../../lib/utils"
import {
  Trophy, Star, Zap, BookCheck, Target, TrendingUp, Medal,
  Download, Award, CheckCircle2, AlertCircle,
} from "lucide-react"

// ─── badge definitions ────────────────────────────────────────────────────────

const BADGE_DEFS = [
  {
    id: "first_task",
    emoji: "🎯",
    icon: Target,
    label: "First Step",
    description: "Completed your very first task",
    color: "text-green-500",
    bg: "bg-green-500/10",
    borderEarned: "border-green-500/30",
    check: ({ completedCount }) => completedCount >= 1,
  },
  {
    id: "quiz_master",
    emoji: "🧠",
    icon: Star,
    label: "Quiz Master",
    description: "Aced a quiz with a perfect 100%",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    borderEarned: "border-yellow-500/30",
    check: ({ perfectQuizzes }) => perfectQuizzes >= 1,
  },
  {
    id: "on_track",
    emoji: "📈",
    icon: TrendingUp,
    label: "On Track",
    description: "Made progress without missing milestones",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    borderEarned: "border-blue-500/30",
    check: ({ overallPct }) => overallPct > 0,
  },
  {
    id: "submitter",
    emoji: "📤",
    icon: BookCheck,
    label: "Submitter",
    description: "Submitted 5 or more tasks",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    borderEarned: "border-purple-500/30",
    check: ({ submissionsCount }) => submissionsCount >= 5,
  },
  {
    id: "halfway",
    emoji: "🏃",
    icon: Zap,
    label: "Halfway There",
    description: "Reached 50% overall progress",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    borderEarned: "border-orange-500/30",
    check: ({ overallPct }) => overallPct >= 50,
  },
  {
    id: "graduate",
    emoji: "🎓",
    icon: Trophy,
    label: "Graduate",
    description: "Completed 100% of the program",
    color: "text-primary",
    bg: "bg-primary/10",
    borderEarned: "border-primary/30",
    check: ({ overallPct }) => overallPct >= 100,
  },
]

// ─── leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ rank, name, pct, isCurrentUser }) {
  const medalColor = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-600" : "text-muted-foreground"
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5",
      isCurrentUser ? "bg-primary/5 border border-primary/20" : "hover:bg-accent/50"
    )}>
      <div className={cn("w-6 text-center font-bold text-sm shrink-0", medalColor)}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </div>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
          {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium truncate", isCurrentUser && "text-primary")}>
            {name}
            {isCurrentUser && <span className="ml-1 text-xs text-primary/70">(you)</span>}
          </span>
        </div>
        <Progress value={pct} className="h-1.5 mt-1" />
      </div>
      <span className="text-sm font-semibold shrink-0">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Achievements() {
  const { user, userDoc } = useAuth()

  const [progressDoc, setProgressDoc] = useState(null)
  const [submissionsCount, setSubmissionsCount] = useState(0)
  const [perfectQuizzes, setPerfectQuizzes] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)

  useEffect(() => {
    if (!user?.uid || !userDoc) return

    async function load() {
      setLoading(true)
      try {
        // Progress doc
        const progSnap = await getDoc(doc(db, "progress", user.uid))
        const prog = progSnap.exists() ? progSnap.data() : null
        setProgressDoc(prog)

        // Submissions count
        const subSnap = await getDocs(
          query(collection(db, "submissions"), where("user_id", "==", user.uid))
        )
        setSubmissionsCount(subSnap.size)

        // Perfect quiz count
        const quizSnap = await getDocs(
          query(
            collection(db, "quiz_results"),
            where("user_id", "==", user.uid),
            where("score", "==", 100)
          )
        )
        setPerfectQuizzes(quizSnap.size)

        // Cohort leaderboard
        const cohortId = userDoc.cohort_ids?.[0]
        if (cohortId) {
          const cohortSnap = await getDoc(doc(db, "cohorts", cohortId))
          if (cohortSnap.exists()) {
            const memberUids = cohortSnap.data().member_uids || []
            const entries = []
            for (const uid of memberUids) {
              const [pSnap, uSnap] = await Promise.all([
                getDoc(doc(db, "progress", uid)),
                getDoc(doc(db, "users", uid)),
              ])
              const pct = pSnap.exists() ? (pSnap.data().overall_pct ?? 0) : 0
              const name = uSnap.exists() ? uSnap.data().name : "Intern"
              entries.push({ uid, name, pct })
            }
            entries.sort((a, b) => b.pct - a.pct)
            setLeaderboard(entries)
          }
        }
      } catch (err) {
        console.error("Achievements load error:", err)
      }
      setLoading(false)
    }

    load()
  }, [user?.uid, userDoc])

  const overallPct = progressDoc?.overall_pct ?? 0
  const completedCount = (progressDoc?.completed_tasks ?? []).length

  const stats = { completedCount, submissionsCount, perfectQuizzes, overallPct }
  const earnedBadges = BADGE_DEFS.filter((b) => b.check(stats))
  const totalBadges = BADGE_DEFS.length

  // Certificate generation
  const handleDownloadCert = async () => {
    setCertLoading(true)
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

      const W = pdf.internal.pageSize.getWidth()
      const H = pdf.internal.pageSize.getHeight()

      // Background
      pdf.setFillColor(248, 250, 252)
      pdf.rect(0, 0, W, H, "F")

      // Border
      pdf.setDrawColor(99, 102, 241)
      pdf.setLineWidth(3)
      pdf.rect(20, 20, W - 40, H - 40)
      pdf.setLineWidth(1)
      pdf.rect(28, 28, W - 56, H - 56)

      // Title
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(36)
      pdf.setTextColor(30, 30, 60)
      pdf.text("Certificate of Completion", W / 2, 120, { align: "center" })

      // Subtitle
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(14)
      pdf.setTextColor(100, 100, 120)
      pdf.text("This certifies that", W / 2, 165, { align: "center" })

      // Name
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(28)
      pdf.setTextColor(99, 102, 241)
      pdf.text(userDoc?.name || "Intern", W / 2, 215, { align: "center" })

      // Body
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(14)
      pdf.setTextColor(100, 100, 120)
      pdf.text("has successfully completed the Wasel Internship Program", W / 2, 255, { align: "center" })
      pdf.text("with full mastery of all required tracks and milestones.", W / 2, 280, { align: "center" })

      // Date
      pdf.setFontSize(12)
      pdf.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, W / 2, 340, { align: "center" })

      // Footer
      pdf.setFontSize(10)
      pdf.setTextColor(150, 150, 170)
      pdf.text("وصل Wasel Internship Management Portal", W / 2, H - 50, { align: "center" })

      pdf.save(`wasel-certificate-${(userDoc?.name || "intern").replace(/\s+/g, "-")}.pdf`)
    } catch (err) {
      console.error("PDF error:", err)
    }
    setCertLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4" />
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Achievements</h1>
        <p className="text-muted-foreground">
          {earnedBadges.length} of {totalBadges} badges earned
        </p>
      </div>

      {/* Progress to all badges */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Badge Progress</span>
            <span className="text-primary font-semibold">{earnedBadges.length}/{totalBadges}</span>
          </div>
          <Progress value={(earnedBadges.length / totalBadges) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Badge grid */}
      <div>
        <h2 className="text-base font-semibold mb-4">Badges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {BADGE_DEFS.map((badge) => {
            const earned = badge.check(stats)
            const Icon = badge.icon
            return (
              <div
                key={badge.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  earned
                    ? `${badge.bg} ${badge.borderEarned}`
                    : "opacity-40 grayscale bg-muted/20 border-border"
                )}
              >
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full text-3xl",
                  earned ? badge.bg : "bg-muted"
                )}>
                  {badge.emoji}
                </div>
                <div>
                  <p className={cn("text-xs font-semibold", earned ? badge.color : "text-muted-foreground")}>
                    {badge.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {badge.description}
                  </p>
                </div>
                {earned && (
                  <Badge variant="success" className="text-xs px-1.5 py-0 h-4">Earned</Badge>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Certificate section */}
      <div>
        <h2 className="text-base font-semibold mb-1">Certificate</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Complete 100% of your program to unlock your certificate.
        </p>
        <Card className={cn(
          "border-2 transition-colors",
          overallPct >= 100 ? "border-primary/30 bg-primary/5" : "border-dashed"
        )}>
          <CardContent className="p-6 flex items-center gap-4 flex-wrap">
            <div className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full shrink-0",
              overallPct >= 100 ? "bg-primary/10" : "bg-muted"
            )}>
              {overallPct >= 100
                ? <Trophy className="h-8 w-8 text-primary" />
                : <Award className="h-8 w-8 text-muted-foreground" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {overallPct >= 100 ? "Certificate Ready!" : "Certificate Locked"}
              </p>
              {overallPct >= 100 ? (
                <p className="text-sm text-muted-foreground">
                  Congratulations on completing the program!
                </p>
              ) : (
                <div className="space-y-1 mt-1">
                  <p className="text-sm text-muted-foreground">
                    {Math.round(overallPct)}% complete — {100 - Math.round(overallPct)}% to go
                  </p>
                  <Progress value={overallPct} className="h-2 max-w-xs" />
                </div>
              )}
            </div>
            {overallPct >= 100 && (
              <Button onClick={handleDownloadCert} disabled={certLoading} className="gap-2 shrink-0">
                <Download className="h-4 w-4" />
                {certLoading ? "Generating..." : "Download Certificate"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Medal className="h-5 w-5 text-yellow-500" />
          <h2 className="text-base font-semibold">Cohort Leaderboard</h2>
        </div>
        {leaderboard.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No cohort data available yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-3 space-y-1">
              {leaderboard.map((entry, idx) => (
                <LeaderboardRow
                  key={entry.uid}
                  rank={idx + 1}
                  name={entry.name}
                  pct={entry.pct}
                  isCurrentUser={entry.uid === user?.uid}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
