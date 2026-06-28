import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection, onSnapshot, getDocs, query, where,
  doc, updateDoc, arrayUnion, deleteDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Badge } from "../../components/ui/badge"
import { Progress } from "../../components/ui/progress"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Checkbox } from "../../components/ui/checkbox"
import {
  Users, Search, ChevronRight, UserCheck, Trash2, UserPlus,
} from "lucide-react"
import { cn } from "../../lib/utils"
import CreateAccount from "./CreateAccount"

const TRACK_OPTIONS = ["frontend", "backend", "fullstack", "devops", "git", "ai", "cloud", "security"]
const STATUS_OPTIONS = ["active", "inactive", "graduated", "withdrawn"]

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function InternQueue() {
  const navigate = useNavigate()

  const [interns, setInterns] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [cohorts, setCohorts] = useState([])
  const [cohortMap, setCohortMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCohort, setFilterCohort] = useState("all")
  const [filterTrack, setFilterTrack] = useState("all")

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Create account
  const [createAccountOpen, setCreateAccountOpen] = useState(false)

  // Bulk assign
  const [selected, setSelected] = useState(new Set())
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignCohort, setAssignCohort] = useState("")
  const [assignGroup, setAssignGroup] = useState("")
  const [groups, setGroups] = useState([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const unsubs = []

    const q = query(collection(db, "users"), where("role", "==", "intern"))
    unsubs.push(
      onSnapshot(q, (snap) => {
        setInterns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, console.error)
    )

    unsubs.push(
      onSnapshot(collection(db, "progress"), (snap) => {
        const map = {}
        snap.docs.forEach((d) => { map[d.id] = d.data() })
        setProgressMap(map)
      }, console.error)
    )

    getDocs(collection(db, "cohorts")).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setCohorts(list)
      const map = Object.fromEntries(list.map((c) => [c.id, c]))
      setCohortMap(map)
    })

    return () => unsubs.forEach((u) => u())
  }, [])

  // Load groups when assign cohort changes
  useEffect(() => {
    if (!assignCohort) { setGroups([]); return }
    const q = query(collection(db, "groups"), where("cohort_id", "==", assignCohort))
    getDocs(q).then((snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [assignCohort])

  const filtered = interns.filter((intern) => {
    if (search) {
      const s = search.toLowerCase()
      if (!intern.name?.toLowerCase().includes(s) && !intern.email?.toLowerCase().includes(s)) return false
    }
    if (filterStatus !== "all" && intern.status !== filterStatus) return false
    if (filterCohort !== "all" && !(intern.cohort_ids || []).includes(filterCohort)) return false
    if (filterTrack !== "all" && !(intern.track_preference || []).includes(filterTrack)) return false
    return true
  })

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((i) => i.id)))
    }
  }

  const handleBulkAssign = async () => {
    if (!assignCohort || selected.size === 0) return
    setAssigning(true)
    try {
      const uids = Array.from(selected)
      // Update cohort
      await updateDoc(doc(db, "cohorts", assignCohort), {
        member_uids: arrayUnion(...uids),
      })
      // Update each user
      await Promise.all(
        uids.map((uid) =>
          updateDoc(doc(db, "users", uid), {
            cohort_ids: arrayUnion(assignCohort),
            ...(assignGroup ? { group_ids: arrayUnion(assignGroup) } : {}),
          })
        )
      )
      // Update group
      if (assignGroup) {
        await updateDoc(doc(db, "groups", assignGroup), {
          member_uids: arrayUnion(...uids),
        })
      }
      setAssignOpen(false)
      setSelected(new Set())
      setAssignCohort("")
      setAssignGroup("")
    } catch (err) {
      console.error(err)
      alert("Failed to assign interns: " + err.message)
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "users", deleteTarget.id))
      setDeleteTarget(null)
      setSelected((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next })
    } catch (err) {
      console.error(err)
      alert("Failed to delete intern: " + err.message)
    } finally {
      setDeleting(false)
    }
  }

const statusColor = {
    active: "success",
    inactive: "secondary",
    graduated: "default",
    withdrawn: "destructive",
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intern Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {interns.length} intern{interns.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                <UserCheck className="h-4 w-4" />
                Assign {selected.size} intern{selected.size > 1 ? "s" : ""}
              </Button>
            )}
            <Button onClick={() => setCreateAccountOpen(true)}>
              <UserPlus className="h-4 w-4" /> Create Account
            </Button>
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
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="w-36">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select value={filterCohort} onValueChange={setFilterCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="Cohort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={filterTrack} onValueChange={setFilterTrack}>
                <SelectTrigger>
                  <SelectValue placeholder="Track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tracks</SelectItem>
                  {TRACK_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(filterStatus !== "all" || filterCohort !== "all" || filterTrack !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch(""); setFilterStatus("all"); setFilterCohort("all"); setFilterTrack("all")
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filtered.length} intern{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== interns.length && ` (filtered from ${interns.length})`}
            </CardTitle>
            {filtered.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={selectAll}
              >
                {selected.size === filtered.length ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No interns found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((intern) => {
                const prog = progressMap[intern.id]
                const pct = prog?.overall_pct ?? null
                const cohortNames = (intern.cohort_ids || [])
                  .map((cid) => cohortMap[cid]?.name)
                  .filter(Boolean)
                  .join(", ")

                return (
                  <div
                    key={intern.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-md transition-colors group",
                      selected.has(intern.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={selected.has(intern.id)}
                      onCheckedChange={() => toggleSelect(intern.id)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(intern.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Main info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/trainer/interns/${intern.id}`)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{intern.name}</span>
                        <Badge variant={statusColor[intern.status] || "outline"} className="text-xs py-0 capitalize">
                          {intern.status || "unknown"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground truncate max-w-48">{intern.email}</span>
                        {cohortNames && (
                          <span className="text-xs text-muted-foreground">· {cohortNames}</span>
                        )}
                        {(intern.track_preference || []).length > 0 && (
                          <div className="flex gap-1">
                            {intern.track_preference.slice(0, 2).map((t) => (
                              <Badge key={t} variant="outline" className="text-xs py-0 capitalize">{t}</Badge>
                            ))}
                            {intern.track_preference.length > 2 && (
                              <Badge variant="outline" className="text-xs py-0">
                                +{intern.track_preference.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div
                      className="w-28 shrink-0 cursor-pointer hidden sm:block"
                      onClick={() => navigate(`/trainer/interns/${intern.id}`)}
                    >
                      {pct !== null ? (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className={cn("font-medium", risk ? "text-red-500" : "")}>
                              {Math.round(pct)}%
                            </span>
                          </div>
                          <Progress
                            value={pct}
                            className={cn("h-1.5", risk && "[&>div]:bg-red-500")}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No progress</span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(intern) }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => navigate(`/trainer/interns/${intern.id}`)}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Intern</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium">{deleteTarget?.name}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Cohort</DialogTitle>
            <DialogDescription>
              Assign {selected.size} selected intern{selected.size > 1 ? "s" : ""} to a cohort and optionally a group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cohort</Label>
              <Select value={assignCohort} onValueChange={setAssignCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <Select
                value={assignGroup}
                onValueChange={setAssignGroup}
                disabled={!assignCohort || groups.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!assignCohort ? "Select cohort first" : "No group"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleBulkAssign} disabled={!assignCohort || assigning}>
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateAccount open={createAccountOpen} onOpenChange={setCreateAccountOpen} />
      </div>
    </div>
  )
}
