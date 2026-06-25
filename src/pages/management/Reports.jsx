import { useEffect, useState, useCallback } from "react"
import {
  collection, getDocs, query, where, getDoc, doc, orderBy,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Separator } from "../../components/ui/separator"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import { cn } from "../../lib/utils"
import {
  Download, FileText, Users, TrendingUp, Award, BarChart2,
  AlertCircle, CheckCircle2, Clock, Loader2,
} from "lucide-react"

// ─── helpers ─────────────────────────────────────────────────────────────────

function pctBadge(pct) {
  if (pct >= 100) return "success"
  if (pct >= 60) return "warning"
  return "destructive"
}

function pctLabel(pct) {
  if (pct >= 100) return "Complete"
  if (pct >= 60) return "In Progress"
  if (pct > 0) return "Started"
  return "Not Started"
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  const headers = ["Name", "Email", "Overall %", "Status", "Cohort"]
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`,
        r.pct,
        `"${r.status}"`,
        `"${(r.cohortName || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF export ───────────────────────────────────────────────────────────────

async function downloadPDF(cohortName, rows, stats) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const W = pdf.internal.pageSize.getWidth()
  let y = 60

  // Title
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(22)
  pdf.setTextColor(30, 30, 60)
  pdf.text(`Program Report: ${cohortName}`, 40, y)
  y += 30

  // Date
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  pdf.setTextColor(120, 120, 140)
  pdf.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 40, y)
  y += 30

  // Stats
  pdf.setDrawColor(200, 200, 220)
  pdf.line(40, y, W - 40, y)
  y += 20

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  pdf.setTextColor(60, 60, 80)
  pdf.text("Summary", 40, y)
  y += 18

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  const summaryLines = [
    `Total Interns: ${rows.length}`,
    `Avg Completion: ${stats.avg}%`,
    `Certificates Issued: ${stats.certs}`,
    `Completion Rate (100%): ${stats.completionRate}%`,
  ]
  for (const line of summaryLines) {
    pdf.text(line, 40, y)
    y += 16
  }
  y += 14

  // Table header
  pdf.setFillColor(245, 245, 255)
  pdf.rect(40, y - 12, W - 80, 20, "F")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.setTextColor(60, 60, 80)
  pdf.text("Name", 44, y)
  pdf.text("Email", 200, y)
  pdf.text("Progress", 380, y)
  pdf.text("Status", 460, y)
  y += 18

  // Table rows
  pdf.setFont("helvetica", "normal")
  for (const row of rows) {
    if (y > 780) {
      pdf.addPage()
      y = 60
    }
    pdf.setTextColor(40, 40, 60)
    pdf.text((row.name || "—").slice(0, 25), 44, y)
    pdf.text((row.email || "—").slice(0, 30), 200, y)
    pdf.text(`${row.pct}%`, 380, y)
    pdf.setTextColor(row.pct >= 100 ? 22 : row.pct >= 60 ? 160 : 200, row.pct >= 100 ? 163 : row.pct >= 60 ? 120 : 30, row.pct >= 100 ? 74 : 10)
    pdf.text(row.status, 460, y)
    pdf.setTextColor(40, 40, 60)

    y += 18
    pdf.setDrawColor(230, 230, 240)
    pdf.line(40, y - 4, W - 40, y - 4)
  }

  // Footer
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.setTextColor(160, 160, 180)
  pdf.text("وصل Wasel Internship Management Portal", 40, pdf.internal.pageSize.getHeight() - 30)

  pdf.save(`wasel-report-${cohortName.replace(/\s+/g, "-")}.pdf`)
}

// ─── milestone week table ─────────────────────────────────────────────────────

function MilestoneTable({ weekData, loading }) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    )
  }
  if (!weekData || weekData.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No milestone data.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Week</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Milestone</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Completion</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Interns Done</th>
          </tr>
        </thead>
        <tbody>
          {weekData.map((row, idx) => (
            <tr key={row.id} className={cn("border-b last:border-0", idx % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className="text-xs">W{row.week}</Badge>
              </td>
              <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{row.title}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Progress value={row.completionPct} className="h-2 w-20" />
                  <span className="text-xs text-muted-foreground">{Math.round(row.completionPct)}%</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                {row.done}/{row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Reports() {
  const [cohorts, setCohorts] = useState([])
  const [selectedCohortId, setSelectedCohortId] = useState("")
  const [cohortsLoading, setCohortsLoading] = useState(true)

  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)

  const [exporting, setExporting] = useState(false)

  // Load all cohorts
  useEffect(() => {
    async function load() {
      setCohortsLoading(true)
      try {
        const snap = await getDocs(collection(db, "cohorts"))
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setCohorts(data)
        if (data.length > 0) setSelectedCohortId(data[0].id)
      } catch (err) {
        console.error(err)
      }
      setCohortsLoading(false)
    }
    load()
  }, [])

  // Load report for selected cohort
  const loadReport = useCallback(async () => {
    if (!selectedCohortId) return
    setReportLoading(true)
    setReportError(null)
    setReportData(null)
    try {
      const cohortSnap = await getDoc(doc(db, "cohorts", selectedCohortId))
      if (!cohortSnap.exists()) throw new Error("Cohort not found.")
      const cohort = { id: cohortSnap.id, ...cohortSnap.data() }

      const memberUids = cohort.member_uids || []
      const planId = cohort.plan_id

      // Load member details + progress
      const members = []
      let totalPct = 0
      let certs = 0

      for (const uid of memberUids) {
        const [uSnap, pSnap] = await Promise.all([
          getDoc(doc(db, "users", uid)),
          getDoc(doc(db, "progress", uid)),
        ])
        const name = uSnap.exists() ? uSnap.data().name : "Unknown"
        const email = uSnap.exists() ? uSnap.data().email : ""
        const pct = pSnap.exists() ? (pSnap.data().overall_pct ?? 0) : 0
        totalPct += pct
        if (pct >= 100) certs++
        members.push({ uid, name, email, pct, status: pctLabel(pct), cohortName: cohort.name })
      }
      members.sort((a, b) => b.pct - a.pct)

      const avg = memberUids.length > 0 ? Math.round(totalPct / memberUids.length) : 0
      const completionRate = memberUids.length > 0 ? Math.round((certs / memberUids.length) * 100) : 0

      // Milestone week-by-week: plan → tracks → modules → milestones
      let weekData = []
      if (planId) {
        try {
          const tracksSnap = await getDocs(
            query(collection(db, "tracks"), where("plan_id", "==", planId), orderBy("order"))
          )
          const trackIds = tracksSnap.docs.map((d) => d.id)

          if (trackIds.length > 0) {
            const allModules = []
            for (let i = 0; i < trackIds.length; i += 10) {
              const chunk = trackIds.slice(i, i + 10)
              const snap = await getDocs(
                query(collection(db, "modules"), where("track_id", "in", chunk))
              )
              allModules.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            }

            if (allModules.length > 0) {
              const modIds = allModules.map((m) => m.id)
              const allMilestones = []
              for (let i = 0; i < modIds.length; i += 10) {
                const chunk = modIds.slice(i, i + 10)
                const snap = await getDocs(
                  query(collection(db, "milestones"), where("module_id", "in", chunk), orderBy("week_number"))
                )
                allMilestones.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
              }

              // For each milestone, count how many members have completed it
              for (const ms of allMilestones) {
                let done = 0
                for (const member of members) {
                  const pSnap = await getDoc(doc(db, "progress", member.uid))
                  if (pSnap.exists()) {
                    const msStatus = pSnap.data().milestone_status?.[ms.id]
                    if (msStatus === "completed") done++
                  }
                }
                weekData.push({
                  id: ms.id,
                  title: ms.title,
                  week: ms.week_number,
                  done,
                  total: memberUids.length,
                  completionPct: memberUids.length > 0 ? (done / memberUids.length) * 100 : 0,
                })
              }
              weekData.sort((a, b) => a.week - b.week)
            }
          }
        } catch (err) {
          console.warn("Week data load failed:", err)
        }
      }

      setReportData({
        cohort,
        members,
        avg,
        certs,
        completionRate,
        totalMembers: memberUids.length,
        weekData,
      })
    } catch (err) {
      setReportError(err.message)
    }
    setReportLoading(false)
  }, [selectedCohortId])

  useEffect(() => {
    if (selectedCohortId) loadReport()
  }, [selectedCohortId, loadReport])

  const handleExportCSV = () => {
    if (!reportData) return
    downloadCSV(reportData.members, `wasel-${reportData.cohort.name.replace(/\s+/g, "-")}.csv`)
  }

  const handleExportPDF = async () => {
    if (!reportData) return
    setExporting(true)
    try {
      await downloadPDF(reportData.cohort.name, reportData.members, {
        avg: reportData.avg,
        certs: reportData.certs,
        completionRate: reportData.completionRate,
      })
    } catch (err) {
      console.error(err)
    }
    setExporting(false)
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Program Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Cohort-level analytics and exports</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {reportData && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {exporting ? "Generating..." : "Export PDF"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    <div className="p-6 space-y-6">

      {/* Cohort selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium shrink-0">Select Cohort</label>
            {cohortsLoading ? (
              <div className="h-10 w-64 bg-muted rounded-md animate-pulse" />
            ) : (
              <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a cohort..." />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — <span className="text-muted-foreground capitalize">{c.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reportLoading && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {reportError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{reportError}</p>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {reportLoading && !reportData ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Members",
                value: reportData.totalMembers,
                icon: Users,
                color: "bg-primary/10 text-primary",
              },
              {
                label: "Avg Completion",
                value: `${reportData.avg}%`,
                icon: TrendingUp,
                color: "bg-blue-500/10 text-blue-500",
              },
              {
                label: "Completion Rate",
                value: `${reportData.completionRate}%`,
                sub: "Interns at 100%",
                icon: BarChart2,
                color: "bg-green-500/10 text-green-500",
              },
              {
                label: "Certificates",
                value: reportData.certs,
                sub: `of ${reportData.totalMembers}`,
                icon: Award,
                color: "bg-yellow-500/10 text-yellow-500",
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold mt-1">{value}</p>
                      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className={cn("rounded-lg p-2 shrink-0", color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall progress bar */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Cohort Average Completion</span>
                <span className="font-semibold text-primary">{reportData.avg}%</span>
              </div>
              <Progress value={reportData.avg} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Based on {reportData.totalMembers} member{reportData.totalMembers !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* Milestone week table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Week-by-Week Milestone Completion</CardTitle>
              <CardDescription>How many interns completed each milestone</CardDescription>
            </CardHeader>
            <CardContent>
              <MilestoneTable weekData={reportData.weekData} loading={false} />
            </CardContent>
          </Card>

          {/* Member list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">Member Progress</CardTitle>
                  <CardDescription>All cohort members sorted by completion</CardDescription>
                </div>
                <Badge variant="outline">{reportData.members.length} members</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {reportData.members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No members in this cohort.</p>
              ) : (
                <div className="divide-y divide-border">
                  {reportData.members.map((member, idx) => (
                    <div
                      key={member.uid}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground w-6 shrink-0 text-right">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={member.pct} className="h-1.5 flex-1 max-w-[200px]" />
                          <span className="text-xs text-muted-foreground">{member.pct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={pctBadge(member.pct)} className="text-xs">
                          {member.status}
                        </Badge>
                        {member.pct >= 100 && (
                          <Award className="h-4 w-4 text-yellow-500" title="Certificate earned" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : !cohortsLoading && cohorts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">No cohorts found</p>
            <p className="text-muted-foreground text-sm mt-1">Create cohorts first to generate reports.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
    </div>
  )
}
