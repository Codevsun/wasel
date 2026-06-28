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
import {
  Users, Layers, ClipboardList, UserPlus,
  BookOpen, ChevronRight, Clock, CheckCircle2,
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

const STAT_ACCENTS = {
  blue:   { bar: "bg-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/30",   icon: "text-blue-600 dark:text-blue-400" },
  violet: { bar: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", icon: "text-violet-600 dark:text-violet-400" },
  amber:  { bar: "bg-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/30",  icon: "text-amber-600 dark:text-amber-400" },
  red:    { bar: "bg-red-500",    bg: "bg-red-50 dark:bg-red-950/30",    icon: "text-red-600 dark:text-red-400" },
}

function StatCard({ title, value, icon: Icon, description, accent, loading }) {
  const a = STAT_ACCENTS[accent] || STAT_ACCENTS.blue
  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1 w-full", a.bar)} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2.5 rounded-xl", a.bg)}>
            <Icon className={cn("h-5 w-5", a.icon)} />
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
        <p className="text-sm font-medium mt-1">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
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
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    const unsubs = []

    const internQ = query(collection(db, "users"), where("role", "==", "intern"))
    unsubs.push(
      onSnapshot(internQ, (snap) => {
        setInterns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, console.error)
    )

    unsubs.push(
      onSnapshot(collection(db, "cohorts"), (snap) => {
        setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }, console.error)
    )

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

  const internMap = Object.fromEntries(interns.map((i) => [i.id, i]))
  const activeCohorts = cohorts.filter((c) => c.status !== "archived")

  return (
    <div className="min-h-full">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Welcome back. Here's what needs attention.</p>
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
      </div>

      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard
            title="Total Interns"
            value={interns.length}
            icon={Users}
            accent="blue"
            description="Registered intern accounts"
            loading={loading}
          />
          <StatCard
            title="Active Cohorts"
            value={activeCohorts.length}
            icon={Layers}
            accent="violet"
            description="Non-archived cohorts"
            loading={loading}
          />
          <StatCard
            title="Pending Reviews"
            value={pendingSubmissions.length}
            icon={ClipboardList}
            accent="amber"
            description="Submissions awaiting feedback"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
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
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30 mb-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No pending reviews.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pendingSubmissions.slice(0, 6).map((sub) => {
                    const intern = internMap[sub.user_id]
                    const initials = intern?.name
                      ? intern.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "?"
                    return (
                      <Button
                        key={sub.id}
                        variant="ghost"
                        className="w-full flex items-center gap-3 p-2 h-auto justify-start text-left rounded-lg"
                        onClick={() => navigate(`/trainer/reviews/${sub.id}`)}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {intern?.name || sub.user_id}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {sub.type && <span className="capitalize">{sub.type}</span>}
                            {sub.submitted_at && ` · ${timeAgo(sub.submitted_at)}`}
                          </p>
                        </div>
                        {sub.version > 1 && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            v{sub.version}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
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
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <Clock className="h-6 w-6 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">No activity yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((sub) => {
                    const intern = internMap[sub.user_id]
                    const isReviewed = sub.status === "approved" || sub.status === "rejected"
                    return (
                      <div key={sub.id} className="flex items-start gap-3">
                        <div className={cn(
                          "mt-1.5 shrink-0 h-2 w-2 rounded-full",
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
      </div>
    </div>
  )
}
