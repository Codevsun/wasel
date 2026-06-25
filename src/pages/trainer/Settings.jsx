import { useEffect, useState } from "react"
import {
  subscribeToTrainerConfig, saveTrainerConfig,
  LABEL_COLOR_OPTIONS, getLabelClasses,
  DEFAULT_TRACKS, DEFAULT_LABELS,
} from "../../lib/trainerConfig"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Separator } from "../../components/ui/separator"
import { Plus, Trash2, Layers, Tag, RotateCcw } from "lucide-react"
import { cn } from "../../lib/utils"

export default function TrainerSettings() {
  const [tracks, setTracks]         = useState(DEFAULT_TRACKS)
  const [labels, setLabels]         = useState(DEFAULT_LABELS)
  const [trackInput, setTrackInput] = useState("")
  const [labelInput, setLabelInput] = useState("")
  const [labelColor, setLabelColor] = useState("blue")
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(null) // "tracks" | "labels"

  useEffect(() => {
    const unsub = subscribeToTrainerConfig((cfg) => {
      setTracks(cfg.tracks)
      setLabels(cfg.labels)
    })
    return unsub
  }, [])

  const flashSaved = (section) => {
    setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  // ─── Tracks ───────────────────────────────────────────────────────────────

  const addTrack = async () => {
    const val = trackInput.trim()
    if (!val || tracks.map(t => t.toLowerCase()).includes(val.toLowerCase())) return
    const next = [...tracks, val]
    setSaving(true)
    try {
      await saveTrainerConfig({ tracks: next })
      setTrackInput("")
      flashSaved("tracks")
    } finally { setSaving(false) }
  }

  const removeTrack = async (track) => {
    const next = tracks.filter(t => t !== track)
    await saveTrainerConfig({ tracks: next })
  }

  const resetTracks = async () => {
    await saveTrainerConfig({ tracks: DEFAULT_TRACKS })
  }

  // ─── Labels ───────────────────────────────────────────────────────────────

  const addLabel = async () => {
    const val = labelInput.trim()
    if (!val || labels.some(l => l.name.toLowerCase() === val.toLowerCase())) return
    const next = [...labels, { name: val, color: labelColor }]
    setSaving(true)
    try {
      await saveTrainerConfig({ labels: next })
      setLabelInput("")
      flashSaved("labels")
    } finally { setSaving(false) }
  }

  const updateLabelColor = async (name, color) => {
    const next = labels.map(l => l.name === name ? { ...l, color } : l)
    await saveTrainerConfig({ labels: next })
  }

  const removeLabel = async (name) => {
    const next = labels.filter(l => l.name !== name)
    await saveTrainerConfig({ labels: next })
  }

  const resetLabels = async () => {
    await saveTrainerConfig({ labels: DEFAULT_LABELS })
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Labels &amp; Tracks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define the options available when tagging interns across the platform.
        </p>
      </div>

      {/* ── Track Preferences ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Track Preferences</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Shown as tag options on intern profiles
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={resetTracks}>
              <RotateCcw className="h-3 w-3" />
              Reset to defaults
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Existing tracks */}
          <div className="flex flex-wrap gap-2">
            {tracks.map((track) => (
              <span
                key={track}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium"
              >
                {track}
                <button
                  onClick={() => removeTrack(track)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            {tracks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tracks defined yet.</p>
            )}
          </div>

          <Separator />

          {/* Add track */}
          <div className="flex gap-2">
            <Input
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              placeholder="New track name (e.g. Fullstack)"
              className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrack() } }}
            />
            <Button
              onClick={addTrack}
              disabled={saving || !trackInput.trim()}
              className="h-9 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {saved === "tracks" && (
            <p className="text-xs text-green-600 font-medium">Saved.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Trainer Labels ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <Tag className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Trainer Labels</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Semantic tags you can assign to any intern
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={resetLabels}>
              <RotateCcw className="h-3 w-3" />
              Reset to defaults
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Existing labels */}
          <div className="space-y-2">
            {labels.map((lbl) => (
              <div key={lbl.name} className="flex items-center gap-3">
                {/* Preview chip */}
                <span className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium min-w-[120px]",
                  getLabelClasses(lbl.color)
                )}>
                  {lbl.name}
                </span>

                {/* Color dots */}
                <div className="flex gap-1">
                  {LABEL_COLOR_OPTIONS.map((opt) => (
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

                <button
                  onClick={() => removeLabel(lbl.name)}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground">No labels defined yet.</p>
            )}
          </div>

          <Separator />

          {/* Add label */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">New label</Label>
            <div className="flex gap-2">
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Label name (e.g. High Performer)"
                className="h-9"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel() } }}
              />
              <Button
                onClick={addLabel}
                disabled={saving || !labelInput.trim()}
                className="h-9 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Color:</span>
              <div className="flex gap-1.5">
                {LABEL_COLOR_OPTIONS.map((opt) => (
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
              {/* Preview */}
              {labelInput.trim() && (
                <span className={cn(
                  "ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  getLabelClasses(labelColor)
                )}>
                  {labelInput.trim()}
                </span>
              )}
            </div>
          </div>
          {saved === "labels" && (
            <p className="text-xs text-green-600 font-medium">Saved.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
