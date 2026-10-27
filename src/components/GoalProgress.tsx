import type { GlobalTask } from "@/lib/store";
import { goalLabel, progressLabel, weekProgress } from "@/lib/stats";

/** This week's progress against the weekly goal, plus the last few weeks as dots. */
export function GoalProgress({ task, weeks = 6 }: { task: GlobalTask; weeks?: number }) {
  if (!task.weeklyGoal) return null;
  const now = weekProgress(task, 0);
  const past = Array.from({ length: weeks }, (_, i) => weekProgress(task, weeks - 1 - i));

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-muted-foreground">
          Meta: {goalLabel(task.weeklyGoal, task.baseType)}
        </p>
        <p className="text-xs tabular-nums">
          {progressLabel(task, now)}
          {now.met ? " ✓" : ""}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round(now.ratio * 100)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="mr-1 text-[10px] text-muted-foreground">Últimas {weeks} semanas</span>
        {past.map((w) => (
          <span
            key={w.start}
            title={`${w.start}: ${progressLabel(task, w)}`}
            className={`size-2.5 rounded-full ${w.met ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}
