import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AddToDaySheet } from "@/components/AddToDaySheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLongPress } from "@/components/useLongPress";
import { useDailyReset } from "@/components/useDailyReset";
import { useHydrated } from "@/components/useHydrated";
import {
  aggregatedHistory,
  dayKey,
  formatMinutes,
  recentDayKeys,
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
  isParent,
  nested,
  onPrimaryClick,
  onLongPress,
  onRequestEdit,
  onRequestDelete,
}: {
  task: GlobalTask;
  isParent: boolean;
  nested?: boolean;
  onPrimaryClick: () => void;
  onLongPress: () => void;
  onRequestEdit: () => void;
  onRequestDelete: () => void;
}) {
  const moveGlobalTask = useStore((s) => s.moveGlobalTask);
  const { pressing, handlers, consumeLongPress } = useLongPress(onLongPress);
  const loggedTime =
    task.baseType === "Time"
      ? task.history.reduce((total, entry) => total + entry.amountLogged, 0)
      : 0;

  const subtitle =
    task.recurrence === "Once"
      ? `${task.baseType} · ${formatDateDDMMYYYY(task.expiresAt)}${loggedTime > 0 ? ` · ${formatMinutes(loggedTime)} logged` : ""}`
      : isParent
        ? "Major task"
        : task.baseType;

  return (
    <motion.li
      layout
      {...handlers}
      onClick={() => {
        if (consumeLongPress()) return;
        onPrimaryClick();
      }}
      animate={{ scale: pressing ? 0.96 : 1, opacity: pressing ? 0.7 : 1 }}
      transition={{ duration: pressing ? 0.45 : 0.18 }}
      className={`flex select-none items-center justify-between border-b border-border py-4 ${
        nested ? "pl-4" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-[15px]">{task.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            moveGlobalTask(task.id, -1);
          }}
          aria-label="Move up"
          className="p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            moveGlobalTask(task.id, 1);
          }}
          aria-label="Move down"
          className="p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestEdit();
          }}
          aria-label="Edit task"
          className="p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
          aria-label="Delete task"
          className="p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.li>
  );
}

type StatsPeriod = "Total" | "Yearly" | "Monthly" | "Weekly";

function formatDateDDMMYYYY(dateString?: string | null) {
  if (!dateString) return "no date";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
}

function localDateParts(value: string) {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return { year, month, day, date: new Date(year, month - 1, day) };
}

function entriesForPeriod(history: HistoryEntry[], period: StatsPeriod) {
  if (period === "Total") return history;
  const now = localDateParts(dayKey()).date;
  if (period === "Yearly")
    return history.filter((entry) => localDateParts(entry.date).year === now.getFullYear());
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

function HistoryEditor({ task }: { task: GlobalTask }) {
  const updateHistoryEntry = useStore((s) => s.updateHistoryEntry);
  const removeHistoryEntry = useStore((s) => s.removeHistoryEntry);
  const days = recentDayKeys();
  const entries = task.history.filter((e) => days.includes(e.date));

  return (
    <div className="mt-2">
      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Edit last 48 hours
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged in the last 3 days.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">
                {entry.date === days[0] ? "Today" : entry.date === days[1] ? "Yesterday" : formatDateDDMMYYYY(entry.date)}
              </span>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                aria-label={`Amount logged on ${entry.date}`}
                value={String(Math.round(entry.amountLogged))}
                onChange={(e) =>
                  updateHistoryEntry(task.id, entry.id, Math.max(0, Number(e.target.value) || 0))
                }
                className="h-8 w-24 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
              />
              <span className="w-10 text-xs text-muted-foreground">
                {task.baseType === "Time" ? "min" : task.baseType === "Count" ? "reps" : "done"}
              </span>
              <button
                onClick={() => removeHistoryEntry(task.id, entry.id)}
                aria-label="Delete entry"
                className="text-muted-foreground/70 hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskStats({
  task,
  allTasks,
  onClose,
}: {
  task: GlobalTask | null;
  allTasks: GlobalTask[];
  onClose: () => void;
}) {
  const periods: StatsPeriod[] = ["Total", "Yearly", "Monthly", "Weekly"];
  const children = task ? allTasks.filter((g) => g.parentId === task.id) : [];
  const isParent = children.length > 0;
  const history = task ? aggregatedHistory(task, allTasks) : [];

  const parentDaysDone = (entries: HistoryEntry[]) => {
    const dayCounts = new Map<string, Set<string>>();
    children.forEach((child) => {
      child.history.forEach((entry) => {
        if (!entries.includes(entry)) return;
        if (!dayCounts.has(entry.date)) dayCounts.set(entry.date, new Set());
        dayCounts.get(entry.date)!.add(child.id);
      });
    });
    return [...dayCounts.values()].filter((set) => set.size === children.length).length;
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto rounded-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle>{task?.title}</DialogTitle>
          <DialogDescription>
            {isParent ? "Combined progress of its subtasks" : "Progress history"}
          </DialogDescription>
        </DialogHeader>
        {task && (
          <>
            <div className="divide-y divide-border">
              {periods.map((period) => {
                const entries = entriesForPeriod(history, period);
                const daysDone = isParent
                  ? parentDaysDone(entries)
                  : new Set(entries.map((entry) => entry.date)).size;
                const amount = entries.reduce((total, entry) => total + entry.amountLogged, 0);
                const hasTime = isParent 
                  ? children.some((c) => c.baseType === "Time") 
                  : task.baseType === "Time";
                const showAmount = isParent 
                  ? hasTime 
                  : task.baseType !== "Simple";
                return (
                  <div key={period} className="flex items-center justify-between py-4">
                    <span className="text-sm text-muted-foreground">{period}</span>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {daysDone} {daysDone === 1 ? "day" : "days"} done
                      </p>
                      {showAmount && (
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {hasTime ? formatMinutes(amount) : `${amount} total`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!isParent && <HistoryEditor task={task} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Composer({ onClose }: { onClose: () => void }) {
  const addGlobalTask = useStore((s) => s.addGlobalTask);
  const globalTasks = useStore((s) => s.globalTasks);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("Once");
  const [baseType, setBaseType] = useState<TrackingType>("Simple");
  const [parentId, setParentId] = useState<string>("");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState(new Date().toISOString().slice(0, 10));

  const parentOptions = globalTasks.filter(
    (g) => g.recurrence === "Repetitive" && !g.parentId && !g.isGloballyCompleted,
  );

  const submit = () => {
    if (!title.trim()) return;
    addGlobalTask({
      title: title.trim(),
      recurrence,
      baseType,
      parentId: recurrence === "Repetitive" && parentId ? parentId : null,
      ...(recurrence === "Once" && hasExpiration && expiresAt ? { expiresAt } : {}),
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
      {recurrence === "Repetitive" && parentOptions.length > 0 && (
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          aria-label="Part of a major task"
          className="mt-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs text-muted-foreground outline-none"
        >
          <option value="">Standalone task</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              Part of: {p.title}
            </option>
          ))}
        </select>
      )}
      {recurrence === "Once" && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip on={hasExpiration} onClick={() => setHasExpiration(true)}>
            Expires
          </Chip>
          <Chip on={!hasExpiration} onClick={() => setHasExpiration(false)}>
            No expiration
          </Chip>
          {hasExpiration && (
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="ml-auto min-w-0 bg-transparent text-xs text-muted-foreground outline-none"
            />
          )}
        </div>
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

function EditTaskDialog({ task, onClose }: { task: GlobalTask | null; onClose: () => void }) {
  const updateGlobalTask = useStore((s) => s.updateGlobalTask);
  const [title, setTitle] = useState("");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [baseType, setBaseType] = useState<TrackingType>("Simple");

  useMemo(() => {
    if (task) {
      setTitle(task.title);
      setHasExpiration(Boolean(task.expiresAt));
      setExpiresAt(task.expiresAt || new Date().toISOString().slice(0, 10));
      setBaseType(task.baseType);
    }
  }, [task]);

  if (!task) return null;

  const submit = () => {
    if (!title.trim()) return;
    updateGlobalTask(task.id, {
      title: title.trim(),
      baseType,
      expiresAt: task.recurrence === "Once" && hasExpiration && expiresAt ? expiresAt : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm rounded-lg border-border bg-card"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Task Type</label>
            <select
              value={baseType}
              onChange={(e) => setBaseType(e.target.value as TrackingType)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="Simple" className="bg-card text-foreground">Simple</option>
              <option value="Time" className="bg-card text-foreground">Time</option>
              <option value="Count" className="bg-card text-foreground">Count</option>
            </select>
          </div>

          {task.recurrence === "Once" && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Expiration</label>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant={hasExpiration ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHasExpiration(true)}
                >
                  Expires
                </Button>
                <Button
                  type="button"
                  variant={!hasExpiration ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHasExpiration(false)}
                >
                  No expiration
                </Button>
                {hasExpiration && (
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
                  />
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="border border-border">Cancel</Button>
          <Button onClick={submit} className="bg-foreground text-background">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllTasks() {
  useDailyReset();
  const hydrated = useHydrated();
  const globalTasks = useStore((s) => s.globalTasks);
  const dailyTasks = useStore((s) => s.dailyTasks);
  const removeGlobalTask = useStore((s) => s.removeGlobalTask);
  const [selected, setSelected] = useState<GlobalTask | null>(null);
  const [statsTaskId, setStatsTaskId] = useState<string | null>(null);
  const statsTask = globalTasks.find((g) => g.id === statsTaskId) ?? null;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = globalTasks.find((g) => g.id === pendingDeleteId) ?? null;
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const pendingEdit = globalTasks.find((g) => g.id === pendingEditId) ?? null;
  const [composing, setComposing] = useState(false);

  const { expiringOnce, nonExpiringOnce, repetitive, childrenOf, parentIds } = useMemo(() => {
    const active = globalTasks.filter((t) => !t.isGloballyCompleted);
    const parents = new Set(active.map((t) => t.parentId).filter(Boolean) as string[]);
    const once = active.filter((t) => t.recurrence === "Once");
    return {
      expiringOnce: once
        .filter((t) => Boolean(t.expiresAt))
        .sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999")),
      nonExpiringOnce: once.filter((t) => !t.expiresAt),
      repetitive: active.filter((t) => t.recurrence === "Repetitive" && !t.parentId),
      childrenOf: (id: string) => active.filter((t) => t.parentId === id),
      parentIds: parents,
    };
  }, [globalTasks]);

  const plannedToday = new Set(dailyTasks.map((d) => d.globalTaskId));

  const tryPlan = (task: GlobalTask) => {
    if (parentIds.has(task.id) || plannedToday.has(task.id)) return;
    setSelected(task);
  };

  const rowProps = (task: GlobalTask) => ({
    task,
    isParent: parentIds.has(task.id),
    onPrimaryClick: () => {
      if (parentIds.has(task.id)) {
        setStatsTaskId(task.id);
      } else {
        tryPlan(task);
      }
    },
    onLongPress: () => setStatsTaskId(task.id),
    onRequestEdit: () => setPendingEditId(task.id),
    onRequestDelete: () => setPendingDeleteId(task.id),
  });

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

      {hydrated && repetitive.length > 0 && (
        <section className="mb-8">
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Repetitive
          </p>
          <ul>
            {repetitive.map((t) => (
              <div key={t.id}>
                <TaskRow {...rowProps(t)} />
                {childrenOf(t.id).map((child) => (
                  <TaskRow key={child.id} {...rowProps(child)} nested />
                ))}
              </div>
            ))}
          </ul>
        </section>
      )}

      {hydrated && (expiringOnce.length > 0 || nonExpiringOnce.length > 0) && (
        <section className="mb-8">
          {expiringOnce.length > 0 && (
            <div className="mb-6">
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Once · Expires
              </p>
              <ul>
                {expiringOnce.map((t) => (
                  <TaskRow key={t.id} {...rowProps(t)} />
                ))}
              </ul>
            </div>
          )}

          {nonExpiringOnce.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Once · No expiration
              </p>
              <ul>
                {nonExpiringOnce.map((t) => (
                  <TaskRow key={t.id} {...rowProps(t)} />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {hydrated && expiringOnce.length === 0 && nonExpiringOnce.length === 0 && repetitive.length === 0 && (
        <p className="mt-24 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      <AddToDaySheet task={selected} onClose={() => setSelected(null)} />
      <TaskStats task={statsTask} allTasks={globalTasks} onClose={() => setStatsTaskId(null)} />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent className="max-w-sm rounded-lg border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border bg-transparent">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) removeGlobalTask(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditTaskDialog task={pendingEdit} onClose={() => setPendingEditId(null)} />
      <BottomNav />
    </div>
  );
}