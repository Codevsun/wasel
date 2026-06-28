import { useEffect, useState, useMemo } from "react"
import {
  collection, doc, getDoc, getDocs, setDoc, onSnapshot,
  query, where, serverTimestamp, orderBy,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Separator } from "../../components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs"
import { cn } from "../../lib/utils"
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle,
  AlertCircle, Users, Save, TrendingUp, Calendar, Search,
} from "lucide-react"
import { format, subDays, addDays, parseISO, isToday, isWeekend } from "date-fns"

const STATUS_META = {
  present:  { label: "Present",  icon: CheckCircle2, color: "text-green-500",  bg: "bg-green-500/10",  border: "border-green-500/30" },
  late:     { label: "Late",     icon: Clock,        color: "text-amber-500",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  absent:   { label: "Absent",   icon: XCircle,      color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30"   },
  excused:  { label: "Excused",  icon: AlertCircle,  color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/30"  },
}

function todayStr() { return format(new Date(), "yyyy-MM-dd") }

function StatusButton({ value, current, onClick }) {
  const meta = STATUS_META[value]
  const Icon = meta.icon
  const active = current === value
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? cn(meta.bg, meta.border, meta.color)
          : "border-border text-muted-foreground hover:border-border hover:bg-accent"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </button>
  )
}

function AttendanceDot({ status }) {
  if (!status) return <div className="h-3 w-3 rounded-full bg-muted" title="No record" />
  const meta = STATUS_META[status]
  return <div className={cn("h-3 w-3 rounded-full", meta.bg, "border", meta.border)} title={meta.label} />
}

export default function TrainerAttendance() {
  const { user } = useAuth()

  const [tab, setTab] = useState("daily")
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [interns, setInterns] = useState([])
  const [records, setRecords] = useState({})   // uid -> { status, notes }
  const [pendingChanges, setPendingChanges] = useState({}) // uid -> { status, notes }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState("")

  // Reports state
  const [reportRecords, setReportRecords] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  // Load interns
  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "intern")))
      .then(snap => setInterns(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  // Load attendance for selected date
  useEffect(() => {
    if (!selectedDate) return
    const q = query(collection(db, "attendance"), where("date", "==", selectedDate))
    return onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.data().user_id] = d.data() })
      setRecords(map)
      setPendingChanges({})
    })
  }, [selectedDate])

  // Load all records for reports
  useEffect(() => {
    if (tab !== "reports") return
    setReportLoading(true)
    getDocs(query(collection(db, "attendance"), orderBy("date", "desc")))
      .then(snap => {
        setReportRecords(snap.docs.map(d => d.data()))
        setReportLoading(false)
      })
  }, [tab])

  const getStatus = (uid) => pendingChanges[uid]?.status ?? records[uid]?.status ?? null
  const getNotes  = (uid) => pendingChanges[uid]?.notes  ?? records[uid]?.notes  ?? ""

  const setStatus = (uid, status) =>
    setPendingChanges(p => ({ ...p, [uid]: { ...p[uid], status } }))
  const setNotes = (uid, notes) =>
    setPendingChanges(p => ({ ...p, [uid]: { ...p[uid], notes } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(pendingChanges).map(([uid, patch]) => {
          const docId = `${selectedDate}_${uid}`
          const existing = records[uid] || {}
          return setDoc(doc(db, "attendance", docId), {
            ...existing,
            ...patch,
            user_id: uid,
            date: selectedDate,
            marked_by: user.uid,
            created_at: existing.created_at || serverTimestamp(),
          }, { merge: true })
        })
      )
      setPendingChanges({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert("Save failed: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const markAll = (status) => {
    const patch = {}
    filteredInterns.forEach(i => { patch[i.id] = { status } })
    setPendingChanges(p => ({ ...p, ...patch }))
  }

  const hasPending = Object.keys(pendingChanges).length > 0
  const filteredInterns = interns.filter(i =>
    !search || (i.name || i.email || "").toLowerCase().includes(search.toLowerCase())
  )

  // Reports: per-intern stats
  const internStats = useMemo(() => {
    const stats = {}
    interns.forEach(i => { stats[i.id] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 } })
    reportRecords.forEach(r => {
      if (stats[r.user_id]) {
        stats[r.user_id][r.status] = (stats[r.user_id][r.status] || 0) + 1
        stats[r.user_id].total++
      }
    })
    return stats
  }, [reportRecords, interns])

  // Recent 14 days for attendance grid
  const recentDates = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd")
      if (!isWeekend(parseISO(d))) days.push(d)
    }
    return days
  }, [])

  const reportByDateUid = useMemo(() => {
    const map = {}
    reportRecords.forEach(r => { map[`${r.date}_${r.user_id}`] = r.status })
    return map
  }, [reportRecords])

  const overallTodayPresent = interns.filter(i => records[i.id]?.status === "present" || records[i.id]?.status === "late").length

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track daily attendance and view reports</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{overallTodayPresent}/{interns.length} present today</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="daily" className="gap-2"><Calendar className="h-3.5 w-3.5" /> Daily</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><TrendingUp className="h-3.5 w-3.5" /> Reports</TabsTrigger>
        </TabsList>

        {/* ── Daily Tab ── */}
        <TabsContent value="daily" className="space-y-4 pt-2">
          {/* Date navigator */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => format(subDays(parseISO(d), 1), "yyyy-MM-dd"))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {isToday(parseISO(selectedDate)) && <Badge variant="secondary" className="text-xs">Today</Badge>}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => format(addDays(parseISO(d), 1), "yyyy-MM-dd"))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick mark all + search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search interns…" className="pl-8 h-8 text-sm" />
            </div>
            <span className="text-xs text-muted-foreground">Mark all:</span>
            {Object.keys(STATUS_META).map(s => (
              <button key={s} onClick={() => markAll(s)}
                className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  STATUS_META[s].color, STATUS_META[s].bg, STATUS_META[s].border)}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          {/* Intern rows */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {filteredInterns.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">No interns found.</div>
            )}
            {filteredInterns.map((intern, i) => {
              const status = getStatus(intern.id)
              const notes  = getNotes(intern.id)
              const isPending = pendingChanges[intern.id] !== undefined
              const initials = (intern.name || intern.email || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

              return (
                <div key={intern.id}>
                  {i > 0 && <Separator />}
                  <div className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors", isPending && "bg-primary/3")}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{intern.name || intern.email}</p>
                      {status && (
                        <p className={cn("text-xs font-medium", STATUS_META[status]?.color)}>
                          {STATUS_META[status]?.label}
                          {records[intern.id]?.check_in_time && ` · checked in ${format(records[intern.id].check_in_time.toDate(), "h:mm a")}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {Object.keys(STATUS_META).map(s => (
                        <StatusButton key={s} value={s} current={status} onClick={v => setStatus(intern.id, v)} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Save bar */}
          {hasPending && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
              <p className="text-sm text-muted-foreground">
                {Object.keys(pendingChanges).length} unsaved change{Object.keys(pendingChanges).length !== 1 ? "s" : ""}
              </p>
              <Button onClick={handleSave} disabled={saving} className="gap-2 h-8">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save Attendance"}
              </Button>
            </div>
          )}
          {saved && <p className="text-xs text-green-600 font-medium text-center">Attendance saved.</p>}
        </TabsContent>

        {/* ── Reports Tab ── */}
        <TabsContent value="reports" className="space-y-6 pt-2">
          {reportLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {/* Attendance grid: interns × recent dates */}
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40 shrink-0">Intern</th>
                      {recentDates.map(d => (
                        <th key={d} className="px-1.5 py-2.5 font-medium text-muted-foreground text-center whitespace-nowrap">
                          <div>{format(parseISO(d), "EEE")}</div>
                          <div className="text-[10px] opacity-60">{format(parseISO(d), "d/M")}</div>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-center">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interns.map((intern, i) => {
                      const stats = internStats[intern.id] || {}
                      const rate = stats.total > 0
                        ? Math.round(((stats.present || 0) + (stats.late || 0)) / stats.total * 100)
                        : null
                      return (
                        <tr key={intern.id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
                          <td className="px-4 py-2.5 font-medium truncate max-w-[160px]">{intern.name || intern.email}</td>
                          {recentDates.map(d => (
                            <td key={d} className="px-1.5 py-2.5 text-center">
                              <div className="flex justify-center">
                                <AttendanceDot status={reportByDateUid[`${d}_${intern.id}`]} />
                              </div>
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-center">
                            {rate !== null ? (
                              <span className={cn("font-semibold", rate >= 80 ? "text-green-500" : rate >= 60 ? "text-amber-500" : "text-red-500")}>
                                {rate}%
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Legend:</span>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <AttendanceDot status={k} />
                    {v.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-muted" />
                  No record
                </span>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {interns.map(intern => {
                  const stats = internStats[intern.id] || {}
                  const attended = (stats.present || 0) + (stats.late || 0)
                  const rate = stats.total > 0 ? Math.round(attended / stats.total * 100) : null
                  return (
                    <div key={intern.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium truncate">{intern.name || intern.email}</p>
                      <div className="text-2xl font-bold">
                        {rate !== null
                          ? <span className={rate >= 80 ? "text-green-500" : rate >= 60 ? "text-amber-500" : "text-red-500"}>{rate}%</span>
                          : <span className="text-muted-foreground text-base">No data</span>}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {Object.entries(STATUS_META).map(([k, v]) => stats[k] > 0 && (
                          <span key={k} className={cn("text-[10px] font-medium rounded-full px-1.5 py-0.5", v.bg, v.color)}>
                            {stats[k]} {v.label.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
