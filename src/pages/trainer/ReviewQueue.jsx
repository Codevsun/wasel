import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection, onSnapshot, query, where, orderBy, getDocs,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { AWAITING_REVIEW_STATUSES } from "../../lib/submissions"
import { Card, CardContent, CardHeader } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Badge } from "../../components/ui/badge"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  ClipboardList, Search, ChevronRight, FileText, FlaskConical,
  HelpCircle, Upload, ChevronDown, Link2,
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
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const TYPE_ICON = {
  reading: FileText,
  lab: FlaskConical,
  quiz: HelpCircle,
  submission: Upload,
  link: Link2,
  text: FileText,
}

const TYPE_BADGE_VARIANT = {
  reading: "secondary",
  lab: "default",
  quiz: "warning",
  submission: "success",
}

export default function ReviewQueue() {
  const navigate = useNavigate()

  const [submissions, setSubmissions] = useState([])
  const [internMap, setInternMap] = useState({})
  const [cohortMap, setCohortMap] = useState({})
  const [taskMap, setTaskMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [filterCohort, setFilterCohort] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterDate, setFilterDate] = useState("") // date string yyyy-mm-dd
  const [collapsedCohorts, setCollapsedCohorts] = useState(new Set())

  useEffect(() => {
    const subQ = query(
      collection(db, "submissions"),
      where("status", "in", AWAITING_REVIEW_STATUSES),
      orderBy("submitted_at", "desc")
    )

    const unsub = onSnapshot(subQ, async (snap) => {
      const subs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setSubmissions(subs)
      setLoading(false)

      // Load interns
      const uids = [...new Set(subs.map((s) => s.user_id).filter(Boolean))]
      if (uids.length > 0) {
        const internSnap = await getDocs(collection(db, "users"))
        const map = {}
        internSnap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } })
        setInternMap(map)

        // Build cohort map
        const cohortSnap = await getDocs(collection(db, "cohorts"))
        const cmap = {}
        cohortSnap.docs.forEach((d) => { cmap[d.id] = { id: d.id, ...d.data() } })
        setCohortMap(cmap)
      }

      // Load tasks
      const taskIds = [...new Set(subs.map((s) => s.task_id).filter(Boolean))]
      if (taskIds.length > 0) {
        const taskSnap = await getDocs(collection(db, "tasks"))
        const tmap = {}
        taskSnap.docs.forEach((d) => { tmap[d.id] = { id: d.id, ...d.data() } })
        setTaskMap(tmap)
      }
    }, console.error)

    return unsub
  }, [])

  const filtered = submissions.filter((sub) => {
    const intern = internMap[sub.user_id]
    if (search) {
      const s = search.toLowerCase()
      const nameMatch = intern?.name?.toLowerCase().includes(s)
      const taskMatch = taskMap[sub.task_id]?.title?.toLowerCase().includes(s)
      if (!nameMatch && !taskMatch) return false
    }
    if (filterType !== "all") {
      const taskType = taskMap[sub.task_id]?.type
      if (taskType !== filterType && sub.type !== filterType) return false
    }
    if (filterDate) {
      const subDate = sub.submitted_at?.toDate
        ? sub.submitted_at.toDate().toISOString().slice(0, 10)
        : null
      if (subDate !== filterDate) return false
    }
    if (filterCohort !== "all") {
      const internCohorts = intern?.cohort_ids || []
      if (!internCohorts.includes(filterCohort)) return false
    }
    return true
  })

  // Group by cohort
  const grouped = {}
  filtered.forEach((sub) => {
    const intern = internMap[sub.user_id]
    const cohortIds = intern?.cohort_ids || []
    const cohortKey = cohortIds.length > 0 ? cohortIds[0] : "__uncohorted__"
    const cohortName =
      cohortKey === "__uncohorted__"
        ? "Uncohorted Interns"
        : cohortMap[cohortKey]?.name || cohortKey
    if (!grouped[cohortKey]) grouped[cohortKey] = { name: cohortName, items: [] }
    grouped[cohortKey].items.push(sub)
  })

  const toggleCohort = (key) => {
    setCollapsedCohorts((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {submissions.length} pending submission{submissions.length !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search intern or task..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="w-40">
              <Select value={filterCohort} onValueChange={setFilterCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="All cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {Object.values(cohortMap).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {(search || filterCohort !== "all" || filterType !== "all" || filterDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setFilterCohort("all"); setFilterType("all"); setFilterDate("") }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No pending reviews</p>
            <p className="text-sm">
              {submissions.length === 0 ? "All submissions have been reviewed." : "No submissions match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cohortKey, { name, items }]) => {
            const isCollapsed = collapsedCohorts.has(cohortKey)
            return (
              <Card key={cohortKey}>
                <Button
                  variant="ghost"
                  className="w-full text-left p-0 h-auto hover:bg-transparent rounded-none rounded-t-xl"
                  onClick={() => toggleCohort(cohortKey)}
                >
                  <CardHeader className="flex flex-row items-center gap-3 py-3 w-full">
                    <div className="flex-1">
                      <span className="font-semibold text-sm">{name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {items.length} submission{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </CardHeader>
                </Button>

                {!isCollapsed && (
                  <CardContent className="pt-0 pb-3 space-y-1">
                    {items.map((sub) => {
                      const intern = internMap[sub.user_id]
                      const task = taskMap[sub.task_id]
                      const initials = intern?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"
                      const taskType = task?.type
                      const TypeIcon = TYPE_ICON[taskType] || TYPE_ICON[sub.type] || FileText

                      return (
                        <Button
                          key={sub.id}
                          variant="ghost"
                          className="w-full flex items-center gap-3 p-2.5 rounded-md h-auto justify-start text-left group"
                          onClick={() => navigate(`/trainer/reviews/${sub.id}`)}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{intern?.name || sub.user_id}</span>
                              {sub.version > 1 && (
                                <Badge variant="outline" className="text-xs py-0">v{sub.version}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {task?.title || "Unknown task"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={TYPE_BADGE_VARIANT[taskType] || TYPE_BADGE_VARIANT[sub.type] || "outline"} className="text-xs capitalize gap-1">
                              <TypeIcon className="h-3 w-3" />
                              {taskType || sub.type || "submission"}
                            </Badge>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {timeAgo(sub.submitted_at)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Button>
                      )
                    })}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
