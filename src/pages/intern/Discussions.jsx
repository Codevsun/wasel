import { useEffect, useState } from "react"
import {
  collection, query, where, orderBy, getDocs, addDoc, updateDoc,
  doc, getDoc, serverTimestamp, arrayUnion,
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Separator } from "../../components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "../../components/ui/dialog"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "../../components/ui/select"
import { ScrollArea } from "../../components/ui/scroll-area"
import { cn } from "../../lib/utils"
import {
  MessageSquare, Pin, ChevronDown, ChevronUp, Plus, Send, AlertCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function formatTs(ts) {
  if (!ts) return ""
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return ""
  }
}

// ─── Reply item ───────────────────────────────────────────────────────────────

function ReplyItem({ reply, authorNames }) {
  const name = authorNames[reply.author_uid] || "User"
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 rounded-lg bg-muted/40 px-3 py-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{formatTs(reply.created_at)}</span>
        </div>
        <p className="text-sm mt-0.5 whitespace-pre-wrap">{reply.content}</p>
      </div>
    </div>
  )
}

// ─── Discussion card ──────────────────────────────────────────────────────────

function DiscussionCard({ discussion, authorNames, userId, onReplyAdded }) {
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const author = authorNames[discussion.author_uid] || "User"

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const reply = {
        author_uid: userId,
        content: replyText.trim(),
        created_at: new Date().toISOString(),
      }
      await updateDoc(doc(db, "discussions", discussion.id), {
        replies: arrayUnion(reply),
      })
      setReplyText("")
      onReplyAdded(discussion.id, reply)
    } catch (err) {
      setError("Failed to send reply.")
    }
    setSubmitting(false)
  }

  const replies = discussion.replies || []

  return (
    <Card className={cn(discussion.pinned && "border-primary/30 bg-primary/2")}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(author)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{author}</span>
              {discussion.pinned && (
                <Badge variant="default" className="h-5 gap-1 px-1.5 text-xs">
                  <Pin className="h-2.5 w-2.5" />
                  Pinned
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{formatTs(discussion.created_at)}</span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{discussion.content}</p>
          </div>
        </div>

        {/* Toggle replies */}
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {/* Replies */}
        {expanded && (
          <div className="space-y-3 pl-2">
            {replies.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-2">No replies yet. Be the first!</p>
            ) : (
              replies.map((reply, idx) => (
                <ReplyItem key={idx} reply={reply} authorNames={authorNames} />
              ))
            )}

            {/* Add reply */}
            <div className="flex items-start gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials(authorNames[userId])}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Write a reply..."
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply()
                  }}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={submitting || !replyText.trim()}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Sending..." : "Reply"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Discussions() {
  const { user, userDoc } = useAuth()

  const [discussions, setDiscussions] = useState([])
  const [modules, setModules] = useState([])
  const [authorNames, setAuthorNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // New discussion dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [newModuleId, setNewModuleId] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const cohortId = userDoc?.cohort_ids?.[0]

  async function loadDiscussions() {
    if (!cohortId || !user?.uid) return
    setLoading(true)
    setError(null)
    try {
      const q = query(
        collection(db, "discussions"),
        where("cohort_id", "==", cohortId),
        orderBy("pinned", "desc"),
        orderBy("created_at", "desc")
      )
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setDiscussions(data)

      // Collect unique author UIDs and fetch names
      const uids = [...new Set(data.map((d) => d.author_uid))]
      const names = {}
      for (const uid of uids) {
        const userSnap = await getDoc(doc(db, "users", uid))
        if (userSnap.exists()) names[uid] = userSnap.data().name
      }
      // Also add current user
      if (userDoc?.name) names[user.uid] = userDoc.name
      setAuthorNames(names)
    } catch (err) {
      setError("Failed to load discussions.")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDiscussions()
  }, [cohortId, user?.uid])

  // Load modules for the "new discussion" form
  useEffect(() => {
    if (!userDoc?.cohort_ids?.[0]) return
    async function loadModules() {
      try {
        // Get cohort → plan → tracks → modules
        const cohortSnap = await getDoc(doc(db, "cohorts", cohortId))
        if (!cohortSnap.exists()) return
        const planId = cohortSnap.data().plan_id
        if (!planId) return

        const tracksSnap = await getDocs(
          query(collection(db, "tracks"), where("plan_id", "==", planId))
        )
        const trackIds = tracksSnap.docs.map((d) => d.id)

        if (trackIds.length === 0) return

        const allModules = []
        for (let i = 0; i < trackIds.length; i += 10) {
          const chunk = trackIds.slice(i, i + 10)
          const snap = await getDocs(
            query(collection(db, "modules"), where("track_id", "in", chunk), orderBy("order"))
          )
          allModules.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        }
        setModules(allModules)
      } catch {
        // non-critical
      }
    }
    loadModules()
  }, [cohortId])

  const handleCreate = async () => {
    if (!newContent.trim() || !newModuleId) return
    setCreating(true)
    setCreateError(null)
    try {
      const newDisc = {
        module_id: newModuleId,
        cohort_id: cohortId,
        author_uid: user.uid,
        content: newContent.trim(),
        pinned: false,
        created_at: serverTimestamp(),
        replies: [],
      }
      const ref = await addDoc(collection(db, "discussions"), newDisc)
      setDiscussions((prev) => [
        { id: ref.id, ...newDisc, created_at: new Date() },
        ...prev,
      ])
      setAuthorNames((prev) => ({ ...prev, [user.uid]: userDoc?.name || "Me" }))
      setNewContent("")
      setNewModuleId("")
      setDialogOpen(false)
    } catch (err) {
      setCreateError("Failed to create discussion.")
    }
    setCreating(false)
  }

  const handleReplyAdded = (discussionId, reply) => {
    setDiscussions((prev) =>
      prev.map((d) =>
        d.id === discussionId ? { ...d, replies: [...(d.replies || []), reply] } : d
      )
    )
  }

  // Group by module
  const grouped = discussions.reduce((acc, disc) => {
    const key = disc.module_id || "general"
    if (!acc[key]) acc[key] = []
    acc[key].push(disc)
    return acc
  }, {})

  const moduleLabel = (modId) => {
    const mod = modules.find((m) => m.id === modId)
    return mod?.title || (modId === "general" ? "General" : modId)
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your cohort's learning conversations</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Discussion
            </Button>
          </div>
        </div>
      </div>
    <div className="p-6 space-y-6">

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">{error}</p>
          </CardContent>
        </Card>
      ) : !cohortId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">No cohort assigned</p>
            <p className="text-muted-foreground text-sm mt-1">Discussions are available once you're in a cohort.</p>
          </CardContent>
        </Card>
      ) : discussions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">No discussions yet</p>
            <p className="text-muted-foreground text-sm mt-1">Start the first conversation!</p>
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Start a Discussion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([modId, discs]) => (
            <div key={modId} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {moduleLabel(modId)}
                </h2>
                <Separator className="flex-1" />
                <Badge variant="outline" className="text-xs">{discs.length}</Badge>
              </div>
              <div className="space-y-3">
                {discs.map((disc) => (
                  <DiscussionCard
                    key={disc.id}
                    discussion={disc}
                    authorNames={authorNames}
                    userId={user.uid}
                    onReplyAdded={handleReplyAdded}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Discussion Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a Discussion</DialogTitle>
            <DialogDescription>Post a question or thought for your cohort.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={newModuleId} onValueChange={setNewModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a module..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Your message</Label>
              <Textarea
                placeholder="What's on your mind?"
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => { setNewContent(""); setNewModuleId("") }}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={creating || !newContent.trim() || !newModuleId}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {creating ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
