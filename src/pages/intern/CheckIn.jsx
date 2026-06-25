import { useEffect, useState, useCallback } from "react"
import {
  doc, getDoc, setDoc, collection, query, where,
  orderBy, getDocs, serverTimestamp, Timestamp,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { cn } from "../../lib/utils"
import { format, parseISO, isToday, subDays, isWeekend, differenceInMinutes } from "date-fns"
import { Flame, CheckCircle2, LogOut, Clock, Calendar, TrendingUp } from "lucide-react"

function todayStr() { return format(new Date(), "yyyy-MM-dd") }

const MESSAGES_IN  = ["Ready to crush it! 💪", "Let's go! 🚀", "Today is going to be great! ✨", "You showed up — that's half the battle! 🔥"]
const MESSAGES_OUT = ["Great work today! 🎉", "See you tomorrow! 👋", "Rest up, you earned it! 😴", "Another day, another win! 🏆"]
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]

function WeekDot({ date, status, isToday: isTd }) {
  const colors = {
    present: "bg-green-500",
    late:    "bg-amber-400",
    absent:  "bg-red-400/60",
    excused: "bg-blue-400",
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{format(parseISO(date), "EEE")}</span>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
        status ? colors[status] : isTd ? "border-2 border-primary/40 bg-primary/5" : "bg-muted",
        isTd && "ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
      )}>
        {status === "present" || status === "late" ? "✓" : status === "absent" ? "✗" : format(parseISO(date), "d")}
      </div>
    </div>
  )
}

export default function InternCheckIn() {
  const { user, userDoc } = useAuth()

  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ticking, setTicking] = useState(false)
  const [message, setMessage] = useState("")
  const [streak, setStreak] = useState(0)
  const [recentDates, setRecentDates] = useState([])
  const [recentMap, setRecentMap] = useState({})
  const [now, setNow] = useState(new Date())

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      // Today's record
      const todayDoc = await getDoc(doc(db, "attendance", `${todayStr()}_${user.uid}`))
      const rec = todayDoc.exists() ? todayDoc.data() : null
      setTodayRecord(rec)

      // Recent non-weekend days (last 14 days)
      const days = []
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (!isWeekend(parseISO(d))) days.push(d)
      }
      setRecentDates(days)

      // Load attendance records (no orderBy to avoid index requirement)
      const snap = await getDocs(query(
        collection(db, "attendance"),
        where("user_id", "==", user.uid)
      ))
      const map = {}
      snap.docs.forEach(d => { map[d.data().date] = d.data() })
      setRecentMap(map)

      // Compute streak
      let s = 0
      let d = new Date()
      if (!rec || (rec.status !== "present" && rec.status !== "late")) {
        d = subDays(d, 1)
      }
      while (true) {
        const ds = format(d, "yyyy-MM-dd")
        if (isWeekend(parseISO(ds))) { d = subDays(d, 1); continue }
        const r = map[ds]
        if (r && (r.status === "present" || r.status === "late")) {
          s++
          d = subDays(d, 1)
        } else break
      }
      setStreak(s)
    } catch (err) {
      console.warn("Attendance load failed (rules may not be deployed yet):", err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const handleCheckIn = async () => {
    setTicking(true)
    try {
      const docId = `${todayStr()}_${user.uid}`
      await setDoc(doc(db, "attendance", docId), {
        user_id: user.uid,
        date: todayStr(),
        status: "present",
        check_in_time: serverTimestamp(),
        marked_by: "self",
        created_at: serverTimestamp(),
      }, { merge: true })
      setMessage(rand(MESSAGES_IN))
      await loadData()
    } catch (err) {
      alert("Check-in failed. Firestore rules may not be deployed yet.\n\nRun: firebase deploy --only firestore:rules")
    } finally {
      setTicking(false)
    }
  }

  const handleCheckOut = async () => {
    setTicking(true)
    try {
      const docId = `${todayStr()}_${user.uid}`
      await setDoc(doc(db, "attendance", docId), {
        check_out_time: serverTimestamp(),
      }, { merge: true })
      setMessage(rand(MESSAGES_OUT))
      await loadData()
    } catch (err) {
      alert("Check-out failed: " + err.message)
    } finally {
      setTicking(false)
    }
  }

  const checkedIn  = todayRecord?.status === "present" || todayRecord?.status === "late"
  const checkedOut = !!todayRecord?.check_out_time
  const duration   = (checkedIn && checkedOut && todayRecord?.check_in_time && todayRecord?.check_out_time)
    ? differenceInMinutes(todayRecord.check_out_time.toDate(), todayRecord.check_in_time.toDate())
    : checkedIn && todayRecord?.check_in_time
      ? differenceInMinutes(now, todayRecord.check_in_time.toDate())
      : null

  const name = userDoc?.name?.split(" ")[0] || "there"

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Check-In</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Mark your attendance for today</p>
          </div>
        </div>
      </div>
    <div className="flex flex-col items-center justify-start p-6 gap-8">
      {/* Clock */}
      <div className="w-full max-w-md text-center pt-6">
        <p className="text-muted-foreground text-sm">{format(now, "EEEE, MMMM d")}</p>
        <p className="text-4xl font-bold font-mono tabular-nums mt-1">{format(now, "hh:mm:ss a")}</p>
      </div>

      {/* Main check-in card */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-6 shadow-sm">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Hey {name}! 👋</h1>
          <p className="text-sm text-muted-foreground">
            {!checkedIn ? "Mark yourself present for today" : checkedOut ? "You've checked out — great work!" : "You're checked in — have a great session!"}
          </p>
        </div>

        {/* Big button */}
        {!checkedIn ? (
          <button
            onClick={handleCheckIn}
            disabled={ticking}
            className={cn(
              "relative h-36 w-36 rounded-full flex flex-col items-center justify-center gap-2",
              "bg-gradient-to-br from-green-400 to-emerald-600 text-white font-bold text-lg shadow-lg",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "ring-4 ring-green-400/20 hover:ring-green-400/40"
            )}
          >
            <CheckCircle2 className="h-10 w-10" />
            <span className="text-base">{ticking ? "…" : "Check In"}</span>
          </button>
        ) : checkedOut ? (
          <div className="h-36 w-36 rounded-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-400 to-slate-600 text-white">
            <CheckCircle2 className="h-10 w-10" />
            <span className="text-sm font-semibold">Done!</span>
          </div>
        ) : (
          <button
            onClick={handleCheckOut}
            disabled={ticking}
            className={cn(
              "relative h-36 w-36 rounded-full flex flex-col items-center justify-center gap-2",
              "bg-gradient-to-br from-rose-400 to-red-600 text-white font-bold shadow-lg",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "ring-4 ring-rose-400/20 hover:ring-rose-400/40"
            )}
          >
            <LogOut className="h-10 w-10" />
            <span className="text-base">{ticking ? "…" : "Check Out"}</span>
          </button>
        )}

        {/* Message flash */}
        {message && (
          <p className="text-sm font-medium text-primary animate-in fade-in duration-500">{message}</p>
        )}

        {/* Time info */}
        {checkedIn && (
          <div className="flex items-center gap-6 text-sm">
            {todayRecord?.check_in_time && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                In: <span className="font-medium text-foreground">{format(todayRecord.check_in_time.toDate(), "h:mm a")}</span>
              </div>
            )}
            {checkedOut && todayRecord?.check_out_time && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5 text-rose-500" />
                Out: <span className="font-medium text-foreground">{format(todayRecord.check_out_time.toDate(), "h:mm a")}</span>
              </div>
            )}
            {duration !== null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{Math.floor(duration / 60)}h {duration % 60}m</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="w-full max-w-md grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
            <Flame className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">day streak 🔥</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
            <TrendingUp className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            {(() => {
              const vals = Object.values(recentMap)
              const attended = vals.filter(r => r.status === "present" || r.status === "late").length
              const rate = vals.length > 0 ? Math.round(attended / vals.length * 100) : null
              return (
                <>
                  <p className="text-2xl font-bold">{rate !== null ? `${rate}%` : "—"}</p>
                  <p className="text-xs text-muted-foreground">attendance rate</p>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Recent days grid */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Last 2 weeks
        </div>
        <div className="flex gap-2 flex-wrap">
          {recentDates.map(d => (
            <WeekDot
              key={d}
              date={d}
              status={recentMap[d]?.status}
              isToday={d === todayStr()}
            />
          ))}
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Present</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400/60 inline-block" /> Absent</span>
        </div>
      </div>
    </div>
    </div>
  )
}
