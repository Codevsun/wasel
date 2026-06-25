import { useEffect, useState } from "react"
import {
  collection, getDocs, getDoc, doc, query, where, orderBy, limit,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Separator } from "../../components/ui/separator"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { cn } from "../../lib/utils"
import {
  Users, Layers, TrendingUp, Award, AlertTriangle, Activity,
  BookOpen, BarChart2, Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3 animate-pulse">
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-8 bg-muted rounded w-1/3" />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, subtext, icon: Icon, color, loading }) {
  if (loading) return <StatCardSkeleton />
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className={cn("rounded-lg p-3 shrink-0", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HorizontalBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium capitalize">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{count} interns</span>
          <span className="font-semibold text-xs w-10 text-right">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Activity feed item ────────────────────────────────────────────────────────

function ActivityItem({ icon: Icon, text, time, color }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{text}</p>
        {time && <p className="text-xs text-muted-foreground mt-0.5">{time}</p>}
      </div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ManagementOverview() {
  const [loading, setLoading] = useState(true)

  const [totalInterns, setTotalInterns] = useState(0)
  const [activeCohorts, setActiveCohorts] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [certsIssued, setCertsIssued] = useState(0)
  const [atRiskCount, setAtRiskCount] = useState(0)
  const [trackDist, setTrackDist] = useState([]) // [{category, count}]
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Total interns
        const internsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "intern")))
        const interns = internsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTotalInterns(interns.length)

        // Active cohorts
        const cohortsSnap = await getDocs(collection(db, "cohorts"))
        setActiveCohorts(cohortsSnap.size)

        // Progress data for interns
        let totalPct = 0
        let certs = 0
        let atRisk = 0
        const progressData = []
        for (const intern of interns) {
          try {
            const progDoc = await getDoc(doc(db, "progress", intern.id))
            if (progDoc.exists()) {
              const pct = progDoc.data().overall_pct ?? 0
              totalPct += pct
              progressData.push(pct)
              if (pct >= 100) certs++
              // at-risk: overall_pct < 30 and not new (has some data)
              if (pct < 30 && pct > 0) atRisk++
            }
          } catch {
            // skip
          }
        }
        const avg = interns.length > 0 ? totalPct / interns.length : 0
        setAvgCompletion(Math.round(avg))
        setCertsIssued(certs)
        setAtRiskCount(atRisk)

        // Track distribution — count interns per track category
        const tracksSnap = await getDocs(collection(db, "tracks"))
        const tracks = tracksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const catMap = {}
        for (const track of tracks) {
          const cat = track.category || "General"
          if (!catMap[cat]) catMap[cat] = 0
        }
        // Count interns who have any progress in each track category
        for (const intern of interns.slice(0, 20)) {
          try {
            const pd = await getDoc(doc(db, "progress", intern.id))
            if (pd.exists()) {
              const tp = pd.data().track_pct || {}
              for (const trackId of Object.keys(tp)) {
                const track = tracks.find((t) => t.id === trackId)
                const cat = track?.category || "General"
                if (!catMap[cat]) catMap[cat] = 0
                if (tp[trackId] > 0) catMap[cat]++
              }
            }
          } catch {
            // skip
          }
        }
        // Fall back: count tracks by category if no progress data
        if (Object.values(catMap).every((v) => v === 0)) {
          for (const track of tracks) {
            const cat = track.category || "General"
            catMap[cat] = (catMap[cat] || 0) + 1
          }
        }
        setTrackDist(
          Object.entries(catMap).map(([cat, count]) => ({ category: cat, count })).sort((a, b) => b.count - a.count)
        )

        // Recent cohort activity: last 5 progress updates
        const recentActivity = []
        const sorted = [...interns].sort((a, b) => {
          const aDate = a.last_active?.toDate?.() || new Date(0)
          const bDate = b.last_active?.toDate?.() || new Date(0)
          return bDate - aDate
        }).slice(0, 5)

        for (const intern of sorted) {
          recentActivity.push({
            icon: Activity,
            text: `${intern.name || intern.email} was recently active`,
            time: intern.last_active
              ? formatDistanceToNow(intern.last_active.toDate?.() || new Date(intern.last_active), { addSuffix: true })
              : null,
            color: "bg-primary/10 text-primary",
          })
        }
        setRecentActivity(recentActivity)
      } catch (err) {
        console.error("Overview load error:", err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalTrackInterns = trackDist.reduce((s, t) => s + t.count, 0)
  const barColors = [
    "bg-primary", "bg-blue-500", "bg-purple-500", "bg-green-500",
    "bg-yellow-500", "bg-orange-500", "bg-pink-500",
  ]

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Management Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Program-wide metrics and insights</p>
          </div>
        </div>
      </div>
    <div className="p-6 space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          loading={loading}
          label="Total Interns"
          value={totalInterns}
          icon={Users}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          loading={loading}
          label="Active Cohorts"
          value={activeCohorts}
          icon={Layers}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          loading={loading}
          label="Avg Completion"
          value={`${avgCompletion}%`}
          subtext="Across all interns"
          icon={TrendingUp}
          color="bg-green-500/10 text-green-500"
        />
        <StatCard
          loading={loading}
          label="Certificates Issued"
          value={certsIssued}
          subtext={`${totalInterns > 0 ? Math.round((certsIssued / totalInterns) * 100) : 0}% graduation rate`}
          icon={Award}
          color="bg-yellow-500/10 text-yellow-500"
        />
      </div>

      {/* At-risk alert */}
      {!loading && atRiskCount > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2 bg-yellow-500/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {atRiskCount} intern{atRiskCount !== 1 ? "s" : ""} may be at risk
              </p>
              <p className="text-xs text-muted-foreground">
                {atRiskCount === 1 ? "This intern has" : "These interns have"} made progress but fallen below 30% completion.
                Consider reaching out.
              </p>
            </div>
            <Badge variant="warning" className="ml-auto shrink-0">At Risk</Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Track distribution */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Track Distribution</CardTitle>
              </div>
              <CardDescription>Interns by track category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5 animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/6" />
                    </div>
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                ))
              ) : trackDist.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No track data available.</p>
              ) : (
                trackDist.map(({ category, count }, idx) => (
                  <HorizontalBar
                    key={category}
                    label={category}
                    count={count}
                    total={Math.max(totalTrackInterns, 1)}
                    color={barColors[idx % barColors.length]}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
              ) : (
                recentActivity.map((item, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="my-3" />}
                    <ActivityItem {...item} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Completion distribution */}
      {!loading && totalInterns > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completion Buckets</CardTitle>
            <CardDescription>How interns are distributed by progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Not started", range: [0, 0], color: "text-muted-foreground", bg: "bg-muted" },
                { label: "0–30%", range: [1, 30], color: "text-destructive", bg: "bg-destructive/10" },
                { label: "30–70%", range: [31, 70], color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
                { label: "70–100%", range: [71, 100], color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
              ].map(({ label, range, color, bg }) => (
                <div key={label} className={cn("rounded-lg p-4 space-y-1", bg)}>
                  <p className={cn("text-2xl font-bold", color)}>
                    {/* count - we'd need the data, show placeholder */}
                    —
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Detailed breakdown available in Program Reports.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  )
}
