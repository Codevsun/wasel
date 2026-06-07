import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection, onSnapshot, query, where, orderBy, limit,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { AWAITING_REVIEW_STATUSES } from "../../lib/submissions"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import { Progress } from "../../components/ui/progress"
import {
  Users, Layers, ClipboardList, AlertTriangle, UserPlus,
  BookOpen, Bell, ChevronRight, Clock, CheckCircle2, XCircle,
  FileText, TrendingUp,
} from "lucide-react"
import { cn } from "../../lib/utils"

// Lightweight date helpers
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

function StatCard({ title, value, icon: Icon, description, color, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-md", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function TrainerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [interns, setInterns] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [pendingSubmissions, setPendingSubmissions] = useState([])
  const [progressDocs, setProgressDocs] = useState([])
  const [recentActivity, setRecentActivity] = useState([])

  // Determine start of current week (Sunday)
  const weeksActive = 4 // fallback assumption; real impl would use cohort start_date

  useEffect(() => {
    const unsubs = []

    // Interns
    const internQ = query(collection(db, "users"), where("role", "==", "intern"))
    unsubs.push(
      onSnapshot(internQ, (snap) => {
        setInterns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, console.error)
    )

    // Cohorts
    unsubs.push(
      onSnapshot(collection(db, "cohorts"), (snap) => {
        setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    // Pending submissions
    const subQ = query(
      collection(db, "submissions"),
      where("status", "in", AWAITING_REVIEW_STATUSES),
      orderBy("submitted_at", "desc"),
      limit(20)
    )
    unsubs.push(
      onSnapshot(subQ, (snap) => {
        setPendingSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    // Progress docs
    unsubs.push(
      onSnapshot(collection(db, "progress"), (snap) => {
        setProgressDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    // Recent activity (last 10 submissions of any status)
    const actQ = query(
      collection(db, "submissions"),
      orderBy("submitted_at", "desc"),
      limit(10)
    )
    unsubs.push(
      onSnapshot(actQ, (snap) => {
        setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

    return () => unsubs.forEach((u) => u())
  }, [])

  const expectedPct = Math.min(weeksActive * 10, 100)
  const atRisk = progressDocs.filter(
    (p) => typeof p.overall_pct === "number" && p.overall_pct < expectedPct - 10
  )

  const internMap = Object.fromEntries(interns.map((i) => [i.id, i]))

  const activeCohorts = cohorts.filter((c) => c.status !== "archived")

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Trainer Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back. Here's what needs attention.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => navigate("/trainer/cohorts")}>
            <Layers className="h-4 w-4" />
            New Cohort
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/trainer/create-account")}>
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/trainer/plans")}>
            <BookOpen className="h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Interns"
          value={interns.length}
          icon={Users}
          color="bg-blue-500"
          description="Registered intern accounts"
          loading={loading}
        />
        <StatCard
          title="Active Cohorts"
          value={activeCohorts.length}
          icon={Layers}
          color="bg-violet-500"
          description="Non-archived cohorts"
          loading={loading}
        />
        <StatCard
          title="Pending Reviews"
          value={pendingSubmissions.length}
          icon={ClipboardList}
          color="bg-amber-500"
          description="Submissions awaiting feedback"
          loading={loading}
        />
        <StatCard
          title="At-Risk Interns"
          value={atRisk.length}
          icon={AlertTriangle}
          color="bg-red-500"
          description={`Progress below expected (${expectedPct}%)`}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reviews */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Pending Reviews</CardTitle>
              <CardDescription>Submissions waiting for your feedback</CardDescription>
            </div>
            {pendingSubmissions.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => navigate("/trainer/reviews")}>
                View all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">All caught up! No pending reviews.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingSubmissions.slice(0, 6).map((sub) => {
                  const intern = internMap[sub.user_id]
                  const initials = intern?.name
                    ? intern.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                    : "?"
                  return (
                    <button
                      key={sub.id}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
                      onClick={() => navigate(`/trainer/reviews/${sub.id}`)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {intern?.name || sub.user_id}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sub.type && (
                            <span className="capitalize">{sub.type}</span>
                          )}
                          {sub.submitted_at && ` · ${timeAgo(sub.submitted_at)}`}
                        </p>
                      </div>
                      {sub.version > 1 && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          v{sub.version}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest submission events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No activity yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((sub) => {
                  const intern = internMap[sub.user_id]
                  const isReviewed = sub.status === "approved" || sub.status === "rejected"
                  return (
                    <div key={sub.id} className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 shrink-0 h-2 w-2 rounded-full",
                        sub.status === "approved" ? "bg-green-500" :
                        sub.status === "rejected" ? "bg-red-500" :
                        "bg-amber-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{intern?.name || "An intern"}</span>
                          {" submitted a "}
                          <span className="capitalize">{sub.type || "task"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(sub.submitted_at)}
                          {isReviewed && (
                            <span className={cn(
                              "ml-2 font-medium",
                              sub.status === "approved" ? "text-green-600" : "text-red-600"
                            )}>
                              · {sub.status}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Interns */}
      {atRisk.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <CardTitle className="text-base text-red-600 dark:text-red-400">
                At-Risk Interns
              </CardTitle>
              <CardDescription>
                Progress significantly below expected {expectedPct}%
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRisk.slice(0, 8).map((p) => {
                const intern = internMap[p.id]
                if (!intern) return null
                return (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-3 hover:bg-accent rounded-md p-2 transition-colors text-left"
                    onClick={() => navigate(`/trainer/interns/${p.id}`)}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-red-100 text-red-600 dark:bg-red-900/40">
                        {intern.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{intern.name}</p>
                        <span className="text-xs text-red-500 font-semibold ml-2 shrink-0">
                          {Math.round(p.overall_pct ?? 0)}%
                        </span>
                      </div>
                      <Progress
                        value={p.overall_pct ?? 0}
                        className="h-1.5 [&>div]:bg-red-500"
                      />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
