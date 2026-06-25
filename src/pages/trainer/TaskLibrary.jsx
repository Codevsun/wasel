import { useEffect, useState } from "react"
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, getDocs, getDoc,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Separator } from "../../components/ui/separator"
import { Progress } from "../../components/ui/progress"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "../../components/ui/tabs"
import {
  Plus, Pencil, Trash2, BookOpen, FlaskConical, Upload, Zap, FolderOpen,
  Clock, Send, X, Link2, Users, CheckCircle2, ChevronDown, ChevronUp,
  Star, AlertCircle, Layers, Tag, RotateCcw,
} from "lucide-react"
import { cn } from "../../lib/utils"
import {
  subscribeToTrainerConfig, saveTrainerConfig,
  LABEL_COLOR_OPTIONS, getLabelClasses,
  DEFAULT_TRACKS, DEFAULT_LABELS,
} from "../../lib/trainerConfig"

// ─── constants ───────────────────────────────────────────────────────────────

const TYPE_META = {
  submission: { label: "Submission", icon: Upload,      color: "text-green-500",  bg: "bg-green-500/10"  },
  lab:        { label: "Lab (URL)", icon: FlaskConical, color: "text-purple-500", bg: "bg-purple-500/10" },
  reading:    { label: "Reading",   icon: BookOpen,     color: "text-blue-500",   bg: "bg-blue-500/10"   },
}

const DIFFICULTY_META = {
  easy:   { label: "Easy",   color: "text-green-600",  bg: "bg-green-500/10"  },
  medium: { label: "Medium", color: "text-amber-600",  bg: "bg-amber-500/10"  },
  hard:   { label: "Hard",   color: "text-red-600",    bg: "bg-red-500/10"    },
}

const EMPTY_QUICK = { title: "", content: "", type: "reading", estimated_duration: "" }
const EMPTY_PROJECT = {
  title: "", overview: "", type: "submission", difficulty: "medium",
  estimated_duration: "", requirements: [], deliverables: [], resources: [], skills: [],
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function composeTaskContent(template) {
  const parts = []
  if (template.overview) parts.push(template.overview)
  if (template.requirements?.length) {
    parts.push("\n📋 Requirements:\n" + template.requirements.map(r => `• ${r}`).join("\n"))
  }
  if (template.deliverables?.length) {
    parts.push("\n📦 Deliverables:\n" + template.deliverables.map(d => `• ${d}`).join("\n"))
  }
  if (template.resources?.length) {
    parts.push("\n🔗 Resources:\n" + template.resources.map(r => `• ${r.title}${r.url ? ": " + r.url : ""}`).join("\n"))
  }
  return parts.join("\n")
}

// ─── DynamicList ─────────────────────────────────────────────────────────────

function DynamicList({ label, placeholder, items, onChange }) {
  const [input, setInput] = useState("")

  const add = () => {
    const val = input.trim()
    if (!val) return
    onChange([...items, val])
    setInput("")
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{i + 1}</span>
              <span className="flex-1">{item}</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        />
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── ResourceList ─────────────────────────────────────────────────────────────

function ResourceList({ items, onChange }) {
  const [title, setTitle] = useState("")
  const [url, setUrl]     = useState("")

  const add = () => {
    if (!title.trim()) return
    onChange([...items, { title: title.trim(), url: url.trim() }])
    setTitle("")
    setUrl("")
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Resources & Links</Label>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-sm rounded-md border border-border px-2.5 py-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.title}</p>
                {r.url && <p className="text-xs text-muted-foreground truncate">{r.url}</p>}
              </div>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource title" className="h-8 text-sm" />
        <Input value={url}   onChange={e => setUrl(e.target.value)}   placeholder="https://..." className="h-8 text-sm" />
      </div>
      <Button type="button" size="sm" variant="outline" className="h-8" onClick={add} disabled={!title.trim()}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add resource
      </Button>
    </div>
  )
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onEdit, onDelete, onSend, deletingId }) {
  const meta   = TYPE_META[template.type] || TYPE_META.submission
  const diff   = DIFFICULTY_META[template.difficulty]
  const Icon   = meta.icon
  const [expanded, setExpanded] = useState(false)
  const isProject = template.category === "project"

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
          <Icon className={cn("h-4 w-4", meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{template.title}</span>
            <Badge variant="outline" className="text-xs">{meta.label}</Badge>
            {diff && (
              <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", diff.bg, diff.color)}>
                {diff.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {template.estimated_duration && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {template.estimated_duration}
              </span>
            )}
            {template.skills?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3" /> {template.skills.join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit(template)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn("h-7 w-7", deletingId === template.id ? "text-destructive" : "text-muted-foreground hover:text-destructive")}
            onClick={() => onDelete(template.id)}
            title={deletingId === template.id ? "Click again to confirm delete" : "Delete"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Overview / content */}
      {(template.overview || template.content) && (
        <p className={cn("text-sm text-muted-foreground", !expanded && "line-clamp-2")}>
          {template.overview || template.content}
        </p>
      )}

      {/* Expanded details (project only) */}
      {isProject && expanded && (
        <div className="space-y-3 pt-1">
          {template.requirements?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Requirements</p>
              <ul className="space-y-1">
                {template.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {template.deliverables?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Deliverables</p>
              <ul className="space-y-1">
                {template.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {template.resources?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Resources</p>
              <ul className="space-y-1">
                {template.resources.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-primary underline">{r.title}</a> : r.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 pt-1">
        {isProject && (template.requirements?.length > 0 || template.deliverables?.length > 0 || template.resources?.length > 0) && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "See details"}
          </button>
        )}
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => onSend(template)}>
          <Send className="h-3 w-3" />
          Send to Cohort / Group
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TaskLibrary() {
  const { user } = useAuth()

  const [templates, setTemplates]   = useState([])
  const [cohorts, setCohorts]       = useState([])
  const [groups, setGroups]         = useState([])

  // Labels & Tracks state
  const [tracks, setTracks]         = useState(DEFAULT_TRACKS)
  const [labels, setLabels]         = useState(DEFAULT_LABELS)
  const [trackInput, setTrackInput] = useState("")
  const [labelInput, setLabelInput] = useState("")
  const [labelColor, setLabelColor] = useState("blue")
  const [cfgSaving, setCfgSaving]   = useState(false)
  const [cfgSaved, setCfgSaved]     = useState(null)

  // Form dialog
  const [formOpen, setFormOpen]     = useState(false)
  const [formCategory, setFormCategory] = useState("quick_task")
  const [editingId, setEditingId]   = useState(null)
  const [formTab, setFormTab]       = useState("basics")
  const [form, setForm]             = useState(EMPTY_QUICK)
  const [saving, setSaving]         = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState(null)

  // Send dialog
  const [sendOpen, setSendOpen]     = useState(false)
  const [sendTemplate, setSendTemplate] = useState(null)
  const [sendCohort, setSendCohort] = useState("")
  const [sendGroup, setSendGroup]   = useState("")
  const [memberCount, setMemberCount] = useState(0)
  const [sending, setSending]       = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [sendDone, setSendDone]     = useState(false)

  // Quick task inline assign
  const [formAssignCohort, setFormAssignCohort] = useState("")
  const [formAssignGroup, setFormAssignGroup]   = useState("")

  // Labels & Tracks handlers
  const flashCfg = (s) => { setCfgSaved(s); setTimeout(() => setCfgSaved(null), 2000) }

  const addTrack = async () => {
    const val = trackInput.trim()
    if (!val || tracks.map(t => t.toLowerCase()).includes(val.toLowerCase())) return
    setCfgSaving(true)
    try { await saveTrainerConfig({ tracks: [...tracks, val] }); setTrackInput(""); flashCfg("tracks") }
    finally { setCfgSaving(false) }
  }
  const removeTrack = (track) => saveTrainerConfig({ tracks: tracks.filter(t => t !== track) })
  const resetTracks = () => saveTrainerConfig({ tracks: DEFAULT_TRACKS })

  const addLabel = async () => {
    const val = labelInput.trim()
    if (!val || labels.some(l => l.name.toLowerCase() === val.toLowerCase())) return
    setCfgSaving(true)
    try { await saveTrainerConfig({ labels: [...labels, { name: val, color: labelColor }] }); setLabelInput(""); flashCfg("labels") }
    finally { setCfgSaving(false) }
  }
  const updateLabelColor = (name, color) => saveTrainerConfig({ labels: labels.map(l => l.name === name ? { ...l, color } : l) })
  const removeLabel = (name) => saveTrainerConfig({ labels: labels.filter(l => l.name !== name) })
  const resetLabels = () => saveTrainerConfig({ labels: DEFAULT_LABELS })

  useEffect(() => subscribeToTrainerConfig(cfg => { setTracks(cfg.tracks); setLabels(cfg.labels) }), [])

  // Load templates
  useEffect(() => {
    const q = query(collection(db, "task_templates"), orderBy("created_at", "desc"))
    return onSnapshot(q, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, console.error)
  }, [])

  // Load cohorts and groups
  useEffect(() => {
    getDocs(collection(db, "cohorts")).then(snap => setCohorts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(collection(db, "groups")).then(snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  const quickTasks = templates.filter(t => t.category === "quick_task")
  const projects   = templates.filter(t => t.category === "project")

  // ── member count preview ──
  useEffect(() => {
    if (!sendCohort) { setMemberCount(0); return }
    const cohortDoc = cohorts.find(c => c.id === sendCohort)
    if (!cohortDoc) return
    if (sendGroup) {
      const groupDoc = groups.find(g => g.id === sendGroup)
      setMemberCount((groupDoc?.member_uids || []).length)
    } else {
      setMemberCount((cohortDoc?.member_uids || []).length)
    }
  }, [sendCohort, sendGroup, cohorts, groups])

  const filteredGroups = groups.filter(g => g.cohort_id === sendCohort)

  // Quick task assign preview
  const formAssignGroups = groups.filter(g => g.cohort_id === formAssignCohort)
  const formAssignCount = (() => {
    if (!formAssignCohort) return 0
    if (formAssignGroup) return (groups.find(g => g.id === formAssignGroup)?.member_uids || []).length
    return (cohorts.find(c => c.id === formAssignCohort)?.member_uids || []).length
  })()

  // ── form helpers ──
  const pf = (patch) => setForm(f => ({ ...f, ...patch }))

  const openNew = (cat) => {
    setFormCategory(cat)
    setEditingId(null)
    setForm(cat === "quick_task" ? EMPTY_QUICK : EMPTY_PROJECT)
    setFormTab("basics")
    setFormAssignCohort("")
    setFormAssignGroup("")
    setFormOpen(true)
  }

  const openEdit = (t) => {
    setFormCategory(t.category)
    setEditingId(t.id)
    setForm(t.category === "quick_task"
      ? { title: t.title || "", content: t.content || "", type: t.type || "reading", estimated_duration: t.estimated_duration || "" }
      : {
          title: t.title || "", overview: t.overview || "", type: t.type || "submission",
          difficulty: t.difficulty || "medium", estimated_duration: t.estimated_duration || "",
          requirements: t.requirements || [], deliverables: t.deliverables || [],
          resources: t.resources || [], skills: t.skills || [],
        }
    )
    setFormTab("basics")
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const base = { title: form.title.trim(), type: form.type, category: formCategory, estimated_duration: form.estimated_duration.trim() }
      const payload = formCategory === "quick_task"
        ? { ...base, content: form.content.trim() }
        : {
            ...base,
            overview: form.overview.trim(),
            difficulty: form.difficulty,
            requirements: form.requirements,
            deliverables: form.deliverables,
            resources: form.resources,
            skills: form.skills,
          }
      if (editingId) {
        await updateDoc(doc(db, "task_templates", editingId), payload)
      } else {
        await addDoc(collection(db, "task_templates"), { ...payload, created_by: user?.uid || null, created_at: serverTimestamp() })
      }

      // Bulk-assign quick task to cohort/group members
      if (formCategory === "quick_task" && formAssignCohort) {
        let uids = []
        if (formAssignGroup) {
          const groupDoc = groups.find(g => g.id === formAssignGroup)
          uids = groupDoc?.member_uids || []
        } else {
          const cohortDoc = cohorts.find(c => c.id === formAssignCohort)
          uids = cohortDoc?.member_uids || []
        }
        await Promise.all(uids.map(uid =>
          addDoc(collection(db, "tasks"), {
            title: payload.title,
            content: payload.content || "",
            type: payload.type,
            estimated_duration: payload.estimated_duration || "",
            assigned_to: uid,
            assigned_by: user?.uid || null,
            is_quick: true,
            is_assigned: true,
            status: "not_started",
            created_at: serverTimestamp(),
          })
        ))
      }

      setFormOpen(false)
    } catch (err) {
      console.error(err)
      alert("Failed to save: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (deletingId !== id) { setDeletingId(id); setTimeout(() => setDeletingId(null), 3000); return }
    try { await deleteDoc(doc(db, "task_templates", id)) } catch (err) { alert("Delete failed: " + err.message) }
    setDeletingId(null)
  }

  const openSend = (template) => {
    setSendTemplate(template)
    setSendCohort("")
    setSendGroup("")
    setSendDone(false)
    setSendProgress(0)
    setSendOpen(true)
  }

  const handleSend = async () => {
    if (!sendCohort || !sendTemplate) return
    setSending(true)
    setSendProgress(0)

    try {
      let uids = []
      if (sendGroup) {
        const groupDoc = groups.find(g => g.id === sendGroup)
        uids = groupDoc?.member_uids || []
      } else {
        const cohortDoc = cohorts.find(c => c.id === sendCohort)
        uids = cohortDoc?.member_uids || []
      }

      const content = sendTemplate.category === "project"
        ? composeTaskContent(sendTemplate)
        : sendTemplate.content || ""

      let done = 0
      for (const uid of uids) {
        await addDoc(collection(db, "tasks"), {
          title: sendTemplate.title,
          content,
          type: sendTemplate.type,
          assigned_to: uid,
          assigned_by: user?.uid || null,
          is_assigned: true,
          is_quick: sendTemplate.category === "quick_task",
          template_id: sendTemplate.id,
          ...(sendTemplate.category === "project" ? {
            is_project: true,
            difficulty: sendTemplate.difficulty,
            requirements: sendTemplate.requirements || [],
            deliverables: sendTemplate.deliverables || [],
            resources: sendTemplate.resources || [],
          } : {}),
          created_at: serverTimestamp(),
        })
        done++
        setSendProgress(Math.round((done / uids.length) * 100))
      }
      setSendDone(true)
    } catch (err) {
      console.error(err)
      alert("Failed to send: " + err.message)
    } finally {
      setSending(false)
    }
  }

  // ── section component ──
  const Section = ({ title, description, icon: Icon, iconColor, iconBg, items, cat }) => (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => openNew(cat)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          New {cat === "quick_task" ? "Quick Task" : "Project"}
        </Button>
      </div>

      {items.length === 0 ? (
        <button
          onClick={() => openNew(cat)}
          className="w-full rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-5 w-5 mx-auto mb-2 opacity-40" />
          Add your first {cat === "quick_task" ? "quick task" : "project template"}
        </button>
      ) : (
        <div className="space-y-3">
          {items.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSend={openSend}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Library &amp; Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage reusable tasks, projects, intern labels and track preferences — all in one place.
            </p>
          </div>
        </div>
      </div>
    <div className="p-6 max-w-7xl">

      <div className="flex gap-6 items-start">
        {/* ── Left: Task Library ── */}
        <div className="flex-1 min-w-0 space-y-4">

      <Section
        title="Quick Tasks"
        description="Short, focused assignments — readings, exercises, small deliverables"
        icon={Zap}
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        items={quickTasks}
        cat="quick_task"
      />

      <Section
        title="Complete Projects"
        description="Detailed, structured projects with requirements, deliverables and resources"
        icon={FolderOpen}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        items={projects}
        cat="project"
      />

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className={cn("max-w-lg", formCategory === "project" && "max-w-2xl")}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit" : "New"} {formCategory === "quick_task" ? "Quick Task" : "Project"}
            </DialogTitle>
          </DialogHeader>

          {formCategory === "quick_task" ? (
            /* ── Quick task form ── */
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus
                  placeholder="e.g. Read the Git documentation"
                  value={form.title}
                  onChange={e => pf({ title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Instructions</Label>
                <Textarea
                  placeholder="What should the intern do?"
                  rows={3}
                  className="resize-none"
                  value={form.content || ""}
                  onChange={e => pf({ content: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Submission Type</Label>
                  <Select value={form.type} onValueChange={v => pf({ type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reading">Reading (mark complete)</SelectItem>
                      <SelectItem value="lab">Lab (submit URL)</SelectItem>
                      <SelectItem value="submission">Written Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated Time</Label>
                  <Input placeholder="e.g. 30 min, 2 hours" value={form.estimated_duration || ""} onChange={e => pf({ estimated_duration: e.target.value })} />
                </div>
              </div>

              {/* Assign to cohort/group */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Assign to (optional) — send directly to interns
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={formAssignCohort} onValueChange={v => { setFormAssignCohort(v); setFormAssignGroup("") }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select cohort" /></SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formAssignGroup} onValueChange={setFormAssignGroup} disabled={!formAssignCohort || formAssignGroups.length === 0}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All members" /></SelectTrigger>
                    <SelectContent>
                      {formAssignGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {formAssignCohort && (
                  <p className="text-xs text-muted-foreground">
                    Will be assigned to <span className="font-semibold text-foreground">{formAssignCount}</span> intern{formAssignCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ── Project form with tabs ── */
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="w-full">
                <TabsTrigger value="basics"   className="flex-1">Basics</TabsTrigger>
                <TabsTrigger value="details"  className="flex-1">Requirements</TabsTrigger>
                <TabsTrigger value="resources" className="flex-1">Resources</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Project Title <span className="text-destructive">*</span></Label>
                  <Input
                    autoFocus
                    placeholder="e.g. Build a REST API with authentication"
                    value={form.title || ""}
                    onChange={e => pf({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Overview</Label>
                  <Textarea
                    placeholder="What is this project about? Describe the goal and context..."
                    rows={4}
                    className="resize-none"
                    value={form.overview || ""}
                    onChange={e => pf({ overview: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Submission Type</Label>
                    <Select value={form.type || "submission"} onValueChange={v => pf({ type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submission">Written</SelectItem>
                        <SelectItem value="lab">Lab (URL)</SelectItem>
                        <SelectItem value="reading">Reading</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Difficulty</Label>
                    <Select value={form.difficulty || "medium"} onValueChange={v => pf({ difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Est. Duration</Label>
                    <Input placeholder="e.g. 1 week" value={form.estimated_duration || ""} onChange={e => pf({ estimated_duration: e.target.value })} />
                  </div>
                </div>
                <DynamicList
                  label="Skills Covered"
                  placeholder="e.g. React, Node.js, SQL..."
                  items={form.skills || []}
                  onChange={skills => pf({ skills })}
                />
              </TabsContent>

              <TabsContent value="details" className="space-y-5 pt-2">
                <DynamicList
                  label="Requirements"
                  placeholder="e.g. Use JWT for authentication"
                  items={form.requirements || []}
                  onChange={requirements => pf({ requirements })}
                />
                <Separator />
                <DynamicList
                  label="Deliverables"
                  placeholder="e.g. A working API with documentation"
                  items={form.deliverables || []}
                  onChange={deliverables => pf({ deliverables })}
                />
              </TabsContent>

              <TabsContent value="resources" className="pt-2">
                <ResourceList
                  items={form.resources || []}
                  onChange={resources => pf({ resources })}
                />
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.title?.trim()}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send to Cohort / Group Dialog ── */}
      <Dialog open={sendOpen} onOpenChange={v => { if (!sending) setSendOpen(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send to Cohort or Group</DialogTitle>
          </DialogHeader>

          {sendDone ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-semibold">Sent successfully!</p>
              <p className="text-sm text-muted-foreground">
                "{sendTemplate?.title}" was assigned to {memberCount} intern{memberCount !== 1 ? "s" : ""}.
              </p>
              <Button className="mt-2" onClick={() => setSendOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              {sendTemplate && (
                <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <p className="font-medium truncate">{sendTemplate.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{sendTemplate.category?.replace("_", " ")} · {TYPE_META[sendTemplate.type]?.label}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Cohort <span className="text-destructive">*</span></Label>
                  <Select value={sendCohort} onValueChange={v => { setSendCohort(v); setSendGroup("") }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          <span className="ml-2 text-xs text-muted-foreground">({(c.member_uids || []).length} interns)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sendCohort && filteredGroups.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Group (optional — send to whole cohort if empty)</Label>
                    <Select value={sendGroup} onValueChange={setSendGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="All interns in cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All interns in cohort</SelectItem>
                        {filteredGroups.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                            <span className="ml-2 text-xs text-muted-foreground">({(g.member_uids || []).length})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {sendCohort && memberCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm text-primary font-medium">
                      Will be assigned to {memberCount} intern{memberCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                {sendCohort && memberCount === 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">No interns in this selection.</p>
                  </div>
                )}

                {sending && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Creating tasks… {sendProgress}%</p>
                    <Progress value={sendProgress} className="h-1.5" />
                  </div>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={sending}>Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleSend}
                  disabled={!sendCohort || memberCount === 0 || sending}
                >
                  {sending ? "Sending..." : `Send to ${memberCount || "…"} intern${memberCount !== 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

        </div>{/* end left column */}

        {/* ── Right: Labels & Tracks ── */}
        <div className="w-[420px] shrink-0 sticky top-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-6">
          <div>
            <h2 className="text-base font-semibold">Labels &amp; Tracks</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the options available when tagging interns.
            </p>
          </div>
          <Separator />

          <div className="space-y-6">

          {/* Track Preferences */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Layers className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Track Preferences</p>
                  <p className="text-xs text-muted-foreground">Shown as tag options on intern profiles</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={resetTracks}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {tracks.map(track => (
                <span key={track} className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium">
                  {track}
                  <button onClick={() => removeTrack(track)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {tracks.length === 0 && <p className="text-sm text-muted-foreground">No tracks defined yet.</p>}
            </div>

            <div className="flex gap-2">
              <Input
                value={trackInput}
                onChange={e => setTrackInput(e.target.value)}
                placeholder="New track name (e.g. Fullstack)"
                className="h-9"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTrack() } }}
              />
              <Button onClick={addTrack} disabled={cfgSaving || !trackInput.trim()} className="h-9 shrink-0">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {cfgSaved === "tracks" && <p className="text-xs text-green-600 font-medium">Saved.</p>}
          </div>

          <Separator />

          {/* Trainer Labels */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  <Tag className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Trainer Labels</p>
                  <p className="text-xs text-muted-foreground">Semantic tags you can assign to any intern</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={resetLabels}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>

            <div className="space-y-2">
              {labels.map(lbl => (
                <div key={lbl.name} className="flex items-center gap-3">
                  <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium min-w-[130px]", getLabelClasses(lbl.color))}>
                    {lbl.name}
                  </span>
                  <div className="flex gap-1">
                    {LABEL_COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        title={opt.label}
                        onClick={() => updateLabelColor(lbl.name, opt.key)}
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition-all",
                          getLabelClasses(opt.key).split(" ").find(c => c.startsWith("bg-"))?.replace("/10", "") || "bg-muted",
                          lbl.color === opt.key ? "border-foreground scale-110" : "border-transparent opacity-50 hover:opacity-100"
                        )}
                      />
                    ))}
                  </div>
                  <button onClick={() => removeLabel(lbl.name)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {labels.length === 0 && <p className="text-sm text-muted-foreground">No labels defined yet.</p>}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                  placeholder="Label name (e.g. High Performer)"
                  className="h-9"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLabel() } }}
                />
                <Button onClick={addLabel} disabled={cfgSaving || !labelInput.trim()} className="h-9 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1.5">
                  {LABEL_COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      title={opt.label}
                      onClick={() => setLabelColor(opt.key)}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-all",
                        getLabelClasses(opt.key).split(" ").find(c => c.startsWith("bg-"))?.replace("/10", "") || "bg-muted",
                        labelColor === opt.key ? "border-foreground scale-110" : "border-transparent opacity-50 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
                {labelInput.trim() && (
                  <span className={cn("ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", getLabelClasses(labelColor))}>
                    {labelInput.trim()}
                  </span>
                )}
              </div>
            </div>
            {cfgSaved === "labels" && <p className="text-xs text-green-600 font-medium">Saved.</p>}
          </div>

          </div>{/* end space-y-6 */}
          </div>{/* end card */}
        </div>{/* end right column */}
      </div>{/* end flex */}
    </div>
    </div>
  )
}
