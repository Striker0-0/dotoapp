import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AddToDaySheet } from "@/components/AddToDaySheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLongPress } from "@/components/useLongPress";
import { useDailyReset } from "@/components/useDailyReset";
import { useHydrated } from "@/components/useHydrated";
import {
  formatMinutes,
  useStore,
  type GlobalTask,
  type HistoryEntry,
  type Recurrence,
  type TrackingType,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "All Tasks · Slate" },
      {
        name: "description",
        content: "A calm, minimalist backlog. Hold a task to plan it into your day.",
      },
      { property: "og:title", content: "All Tasks · Slate" },
      {
        property: "og:description",
        content: "A calm, minimalist backlog. Hold a task to plan it into your day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AllTasks,
});

function TaskRow({
  task,
  onLongPress,
  onOpenStats,
}: {
  task: GlobalTask;
  onLongPress: () => void;
  onOpenStats: () => void;
}) {
  const completeGlobalTask = useStore((s) => s.completeGlobalTask);
  const { pressing, handlers, consumeLongPress } = useLongPress(onLongPress);
  const loggedTime = task.baseType === "Time"
    ? task.history.reduce((total, entry) => total + entry.amountLogged, 0)
    : 0;

  return (
    <motion.li
      layout
      {...handlers}
      onClick={() => {
        if (consumeLongPress()) return;
        if (task.recurrence === "Repetitive") onOpenStats();
      }}
      animate={{ scale: pressing ? 0.96 : 1, opacity: pressing ? 0.7 : 1 }}
      transition={{ duration: pressing ? 0.45 : 0.18 }}
      className="flex select-none items-center justify-between border-b border-border py-4"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px]">{task.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {task.recurrence === "Once"
            ? `${task.baseType} · ${task.expiresAt ?? "no date"}${loggedTime > 0 ? ` · ${formatMinutes(loggedTime)} logged` : ""}`
            : `Repetitive · ${task.baseType}`}
        </p>
      </div>
      {task.recurrence === "Once" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              completeGlobalTask(task.id);
            }}
          aria-label="Mark completed"
            className="ml-3 size-7 shrink-0 rounded-full border border-border text-muted-foreground"
        >
          <Check className="size-3.5" />
          </Button>
      )}
    </motion.li>
  );
}

type StatsPeriod = "Total" | "Yearly" | "Monthly" | "Weekly";

function localDateParts(value: string) {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return { year, month, day, date: new Date(year, month - 1, day) };
}

function entriesForPeriod(history: HistoryEntry[], period: StatsPeriod) {
  if (period === "Total") return history;
  const now = new Date();
  if (period === "Yearly") return history.filter((entry) => localDateParts(entry.date).year === now.getFullYear());
  if (period === "Monthly") {
    return history.filter((entry) => {
      const { year, month } = localDateParts(entry.date);
      return year === now.getFullYear() && month === now.getMonth() + 1;
    });
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return history.filter((entry) => {
    const date = localDateParts(entry.date).date;
    return date >= start && date < end;
  });
}

function TaskStats({ task, onClose }: { task: GlobalTask | null; onClose: () => void }) {
  const periods: StatsPeriod[] = ["Total", "Yearly", "Monthly", "Weekly"];
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle>{task?.title}</DialogTitle>
          <DialogDescription>Progress history</DialogDescription>
        </DialogHeader>
        {task && (
          <div className="divide-y divide-border">
            {periods.map((period) => {
              const entries = entriesForPeriod(task.history, period);
              const daysDone = new Set(entries.map((entry) => entry.date)).size;
              const amount = entries.reduce((total, entry) => total + entry.amountLogged, 0);
              return (
                <div key={period} className="flex items-center justify-between py-4">
                  <span className="text-sm text-muted-foreground">{period}</span>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{daysDone} {daysDone === 1 ? "day" : "days"} done</p>
                    {task.baseType !== "Simple" && (
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {task.baseType === "Time" ? formatMinutes(amount) : `${amount} total`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Composer({ onClose }: { onClose: () => void }) {
  const addGlobalTask = useStore((s) => s.addGlobalTask);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("Once");
  const [baseType, setBaseType] = useState<TrackingType>("Simple");
  const [expiresAt, setExpiresAt] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    if (!title.trim()) return;
    addGlobalTask({
      title: title.trim(),
      recurrence,
      baseType,
      ...(recurrence === "Once" ? { expiresAt } : {}),
    });
    onClose();
  };

  const Chip = ({ on, children, ...p }: React.ComponentProps<"button"> & { on: boolean }) => (
    <button
      {...p}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Task title"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <button onClick={onClose} aria-label="Close">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["Once", "Repetitive"] as const).map((r) => (
          <Chip key={r} on={recurrence === r} onClick={() => setRecurrence(r)}>
            {r}
          </Chip>
        ))}
        <span className="mx-1 w-px bg-border" />
        {(["Simple", "Time", "Count"] as const).map((t) => (
          <Chip key={t} on={baseType === t} onClick={() => setBaseType(t)}>
            {t}
          </Chip>
        ))}
      </div>
      {recurrence === "Once" && (
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="mt-3 bg-transparent text-xs text-muted-foreground outline-none"
        />
      )}
      <button
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"
      >
        Add task
      </button>
    </motion.div>
  );
}

function AllTasks() {
  useDailyReset();
  const hydrated = useHydrated();
  const globalTasks = useStore((s) => s.globalTasks);
  const [selected, setSelected] = useState<GlobalTask | null>(null);
  const [statsTask, setStatsTask] = useState<GlobalTask | null>(null);
  const [composing, setComposing] = useState(false);

  const { once, repetitive } = useMemo(() => {
    const active = globalTasks.filter((t) => !t.isGloballyCompleted);
    return {
      once: active
        .filter((t) => t.recurrence === "Once")
        .sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999")),
      repetitive: active.filter((t) => t.recurrence === "Repetitive"),
    };
  }, [globalTasks]);

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-28 pt-12">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">All Tasks</h1>
        </div>
        <button
          onClick={() => setComposing((v) => !v)}
          aria-label="New task"
          className="grid size-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
        >
          <Plus className="size-4" />
        </button>
      </header>

      <AnimatePresence>{composing && <Composer onClose={() => setComposing(false)} />}</AnimatePresence>

      {hydrated && once.length > 0 && (
        <section className="mb-8">
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Once</p>
          <ul>
            {once.map((t) => (
              <TaskRow key={t.id} task={t} onLongPress={() => setSelected(t)} onOpenStats={() => setStatsTask(t)} />
            ))}
          </ul>
        </section>
      )}

      {hydrated && repetitive.length > 0 && (
        <section>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Repetitive
          </p>
          <ul>
            {repetitive.map((t) => (
              <TaskRow key={t.id} task={t} onLongPress={() => setSelected(t)} onOpenStats={() => setStatsTask(t)} />
            ))}
          </ul>
        </section>
      )}

      {hydrated && once.length === 0 && repetitive.length === 0 && (
        <p className="mt-24 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      <AddToDaySheet task={selected} onClose={() => setSelected(null)} />
      <TaskStats task={statsTask} onClose={() => setStatsTask(null)} />
      <BottomNav />
    </div>
  );
}
