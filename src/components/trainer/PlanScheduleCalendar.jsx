import { useRef, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Badge } from "../ui/badge"
import { Minus, Plus } from "lucide-react"
import { cn } from "../../lib/utils"
import { lastScheduledWeek, sortModulesByTrack, weekDateLabel } from "../../lib/cohortSchedule"

const MODULE_COLORS = [
  "bg-violet-500/80 border-violet-400",
  "bg-sky-500/80 border-sky-400",
  "bg-emerald-500/80 border-emerald-400",
  "bg-amber-500/80 border-amber-400",
  "bg-rose-500/80 border-rose-400",
  "bg-indigo-500/80 border-indigo-400",
]

function isWeekInPlacement(week, placement) {
  if (!placement) return false
  const end = placement.start_week + Math.max(1, placement.weeks) - 1
  return week >= placement.start_week && week <= end
}

function rangeFromAnchor(anchor, current) {
  const start = Math.min(anchor, current)
  const end = Math.max(anchor, current)
  return { start_week: start, weeks: end - start + 1 }
}

export default function PlanScheduleCalendar({
  durationWeeks,
  onDurationChange,
  startDate,
  tracks,
  modules,
  placements,
  onPlacementsChange,
}) {
  const [drag, setDrag] = useState(null)
  const draggingRef = useRef(false)
  const total = Math.max(1, Number(durationWeeks) || 8)
  const weeks = Array.from({ length: total }, (_, i) => i + 1)
  const scheduledEnd = lastScheduledWeek(placements)
  const overflow = scheduledEnd > total

  const sortedTracks = [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const colorByModule = Object.fromEntries(
    sortModulesByTrack(modules, tracks).map((m, i) => [m.id, MODULE_COLORS[i % MODULE_COLORS.length]])
  )

  const beginDrag = (moduleId, week) => {
    draggingRef.current = true
    setDrag({ moduleId, anchor: week, current: week })
  }

  const extendDrag = (moduleId, week) => {
    if (!draggingRef.current || !drag || drag.moduleId !== moduleId) return
    setDrag((d) => (d ? { ...d, current: week } : d))
  }

  const endDrag = () => {
    if (drag && draggingRef.current) {
      const next = rangeFromAnchor(drag.anchor, drag.current)
      onPlacementsChange({
        ...placements,
        [drag.moduleId]: next,
      })
    }
    draggingRef.current = false
    setDrag(null)
  }

  const previewPlacement = (moduleId) => {
    if (drag?.moduleId === moduleId) {
      return rangeFromAnchor(drag.anchor, drag.current)
    }
    return placements[moduleId]
  }

  return (
    <div
      className="space-y-3 select-none"
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs">Program length (weeks)</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => onDurationChange(Math.max(1, total - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              min={1}
              max={52}
              className="w-16 h-8 text-center"
              value={total}
              onChange={(e) => onDurationChange(Math.max(1, Number(e.target.value) || 1))}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => onDurationChange(Math.min(52, total + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className={cn("text-xs pb-1", overflow ? "text-amber-600" : "text-muted-foreground")}>
          {scheduledEnd > 0
            ? `Modules span through week ${scheduledEnd} of ${total}`
            : "Drag across weeks to schedule each module"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-max">
          {/* Week header */}
          <div className="flex border-b border-border bg-muted/40">
            <div className="w-44 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border sticky left-0 bg-muted/40 z-10">
              Module
            </div>
            {weeks.map((week) => {
              const dateLabel = weekDateLabel(startDate, week)
              return (
                <div
                  key={week}
                  className="w-14 shrink-0 px-1 py-2 text-center border-r border-border last:border-r-0"
                >
                  <div className="text-xs font-semibold">W{week}</div>
                  {dateLabel && (
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {dateLabel}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {sortedTracks.map((track) => {
            const trackModules = sortModulesByTrack(
              modules.filter((m) => m.track_id === track.id),
              tracks
            )
            if (!trackModules.length) return null

            return (
              <div key={track.id}>
                <div className="flex bg-muted/20 border-b border-border">
                  <div className="w-44 shrink-0 px-3 py-1.5 border-r border-border sticky left-0 bg-muted/20 z-10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize py-0">
                        {track.category}
                      </Badge>
                      <span className="text-xs font-medium truncate">{track.label}</span>
                    </div>
                  </div>
                  <div className="flex-1" />
                </div>

                {trackModules.map((mod) => {
                  const placement = previewPlacement(mod.id)
                  const color = colorByModule[mod.id]

                  return (
                    <div key={mod.id} className="flex border-b border-border last:border-b-0">
                      <div className="w-44 shrink-0 px-3 py-2 text-sm border-r border-border sticky left-0 bg-card z-10">
                        <span className="line-clamp-2 leading-snug">{mod.title}</span>
                      </div>
                      {weeks.map((week) => {
                        const active = isWeekInPlacement(week, placement)
                        const isStart = placement?.start_week === week
                        return (
                          <div
                            key={week}
                            className={cn(
                              "w-14 h-10 shrink-0 border-r border-border last:border-r-0 cursor-crosshair transition-colors",
                              active ? color : "hover:bg-accent/50"
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              beginDrag(mod.id, week)
                            }}
                            onMouseEnter={() => extendDrag(mod.id, week)}
                          >
                            {isStart && placement && (
                              <div className="h-full flex items-center justify-center px-0.5">
                                <span className="text-[9px] font-medium text-white truncate">
                                  {placement.weeks}w
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click and drag across week cells to set each module&apos;s duration. Dates use the cohort start date.
      </p>
    </div>
  )
}
