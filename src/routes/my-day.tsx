import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useDailyReset } from "@/components/useDailyReset";
import { useHydrated } from "@/components/useHydrated";
import { formatMinutes, useStore, type DailyTask } from "@/lib/store";

export const Route = createFileRoute("/my-day")({
  head: () => ({
    meta: [
      { title: "My Day · Slate" },
      {
        name: "description",
        content: "Today's plan only. Everything clears at 4 AM for a blank slate.",
      },
      { property: "og:title", content: "My Day · Slate" },
      {
        property: "og:description",
        content: "Today's plan only. Everything clears at 4 AM for a blank slate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyDay,
});

function DailyRow({ task }: { task: DailyTask }) {
  const title = useStore(
    (s) => s.globalTasks.find((g) => g.id === task.globalTaskId)?.title ?? "Task",
  );
  const { updateDailyValue, toggleDailyDone, removeDailyTask } = useStore();
  const pct = Math.round((task.currentValue / task.targetValue) * 100);
  const done = task.status === "Done";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="group border-b border-border py-4"
    >
      <div className="flex items-center gap-3">
        {task.trackingType === "Simple" ? (
          <button
            onClick={() => toggleDailyDone(task.id)}
            aria-label="Toggle done"
            className={`grid size-7 shrink-0 place-items-center rounded-lg border transition-all ${
              done ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            {done && <Check className="size-4" strokeWidth={2.5} />}
          </button>
        ) : (
          <button
            onClick={() => toggleDailyDone(task.id)}
            aria-label="Toggle done"
            className={`grid size-7 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums transition-all ${
              done ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            {done ? <Check className="size-3.5" strokeWidth={2.5} /> : `${pct}`}
          </button>
        )}

        <p className={`flex-1 truncate text-[15px] ${done ? "text-muted-foreground line-through" : ""}`}>
          {title}
        </p>

        {task.trackingType === "Count" && !done && (
          <div className="flex items-center gap-3">
            <button onClick={() => updateDailyValue(task.id, task.currentValue - 1)}>
              <Minus className="size-4 text-muted-foreground" />
            </button>
            <span className="min-w-12 text-center text-sm tabular-nums">
              {task.currentValue}/{task.targetValue}
            </span>
            <button onClick={() => updateDailyValue(task.id, task.currentValue + 1)}>
              <Plus className="size-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <button
          onClick={() => removeDailyTask(task.id)}
          aria-label="Remove"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      {task.trackingType === "Time" && !done && (
        <div className="mt-3 pl-10">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-foreground"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatMinutes(task.currentValue)} / {formatMinutes(task.targetValue)}
            </span>
            <div className="flex gap-1.5">
              {[5, 15, 30].map((m) => (
                <button
                  key={m}
                  onClick={() => updateDailyValue(task.id, task.currentValue + m)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                >
                  +{m}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.li>
  );
}

function MyDay() {
  useDailyReset();
  const hydrated = useHydrated();
  const all = useStore((s) => s.dailyTasks);
  const dailyTasks = hydrated ? all : [];
  const doing = dailyTasks.filter((t) => t.status === "Doing");
  const done = dailyTasks.filter((t) => t.status === "Done");

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-28 pt-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">My Day</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {" · resets at 4 AM"}
        </p>
      </header>

      {dailyTasks.length === 0 ? (
        <p className="mt-24 text-center text-sm text-muted-foreground">
          A blank slate. Hold a task in All Tasks to plan today.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Doing
            </p>
            <ul>
              <AnimatePresence initial={false}>
                {doing.map((t) => (
                  <DailyRow key={t.id} task={t} />
                ))}
              </AnimatePresence>
            </ul>
            {doing.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">All done for today.</p>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Done
              </p>
              <ul>
                <AnimatePresence initial={false}>
                  {done.map((t) => (
                    <DailyRow key={t.id} task={t} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}
