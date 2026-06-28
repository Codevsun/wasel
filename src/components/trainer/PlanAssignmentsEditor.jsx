import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select"
import {
  addPlanAssignment,
  markPlanCompleted,
  removePlanAssignment,
} from "../../lib/planAssignments"
import { BookOpen, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"

const STATUS_META = {
  active:    { label: "Active",    variant: "default" },
  pending:   { label: "Up next",   variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
}

export default function PlanAssignmentsEditor({
  assignments = [],
  onChange,
  templatePlans = [],
  className,
}) {
  const assignedIds = new Set(assignments.map((a) => a.plan_id))
  const availableToAdd = templatePlans.filter((p) => !assignedIds.has(p.id))

  const handleAdd = (planId) => {
    if (!planId || planId === "none") return
    onChange(addPlanAssignment(assignments, planId))
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Plan Templates</Label>

      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4 text-center">
          No plans assigned yet. Add one below.
        </p>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-border divide-y divide-border overflow-hidden">
          {assignments.map((item) => {
            const plan = templatePlans.find((p) => p.id === item.plan_id)
            const meta = STATUS_META[item.status] || STATUS_META.pending
            const canComplete = item.status === "active"
            const canRemove = item.status === "pending"

            return (
              <div
                key={item.plan_id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 bg-background",
                  item.status === "completed" && "opacity-70"
                )}
              >
                {item.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : item.status === "active" ? (
                  <Circle className="h-4 w-4 shrink-0 text-primary fill-primary/20" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{plan?.name || "Unknown plan"}</span>
                    <Badge variant={meta.variant} className="text-[10px] h-5 shrink-0">
                      {meta.label}
                    </Badge>
                  </div>
                </div>
                {canComplete && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={() => onChange(markPlanCompleted(assignments, item.plan_id))}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark done
                  </Button>
                )}
                {canRemove && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(removePlanAssignment(assignments, item.plan_id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {availableToAdd.length > 0 && (
        <Select onValueChange={handleAdd}>
          <SelectTrigger className="h-9">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              <SelectValue placeholder="Add another plan…" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {assignments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          The intern works on the <span className="font-medium text-foreground">Active</span> plan.
          Mark it done when finished to move to the next one.
        </p>
      )}
    </div>
  )
}
