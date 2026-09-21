import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pause, Play, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDailyReset } from "@/components/useDailyReset";
import { useHydrated } from "@/components/useHydrated";
import { formatMinutes, useStore, type DailyTask } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

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

const numberField =
  "h-8 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]";

function DailyRow({ task }: { task: DailyTask }) {
  const title = useStore(
    (s) => s.globalTasks.find((g) => g.id === task.globalTaskId)?.title ?? "Task",
  );
  const { setDailyProgress, toggleDailyDone, removeDailyTask, startTimer, stopTimer } = useStore();

  const running = Boolean(task.timerStartTime);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);

  const liveValue = running
    ? task.currentValue + (now - (task.timerStartTime ?? now)) / 60000
    : task.currentValue;

  // Local input state, auto-saved 1s after typing stops.
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [count, setCount] = useState("");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dirty.current) return;
    if (task.trackingType === "Time") {
      const total = Math.round(liveValue);
      setHours(total >= 60 ? String(Math.floor(total / 60)) : "");
      setMinutes(total > 0 ? String(total % 60) : "");
    } else if (task.trackingType === "Count") {
      setCount(task.currentValue > 0 ? String(task.currentValue) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.currentValue, running, now]);

  const queueSave = (value: number) => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      setDailyProgress(task.id, value);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onTime = (h: string, m: string) => {
    setHours(h);
    setMinutes(m);
    queueSave(Math.max(0, Number(h) || 0) * 60 + Math.max(0, Number(m) || 0));
  };

  const onCount = (value: string) => {
    setCount(value);
    queueSave(Math.max(0, Math.floor(Number(value) || 0)));
  };

  const pct = Math.min(999, Math.round((liveValue / task.targetValue) * 100));
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
          <div
            aria-label={`${pct}% complete`}
            className={`grid size-8 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums ${
              done ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            {`${pct}%`}
          </div>
        )}

        <p className={`flex-1 truncate text-[15px] ${done ? "text-muted-foreground line-through" : ""}`}>
          {title}
        </p>

        {task.trackingType === "Time" && (
          <Button
            size="icon"
            variant={running ? "default" : "outline"}
            aria-label={running ? "Pause stopwatch" : "Start stopwatch"}
            className="size-8 shrink-0 rounded-full"
            onClick={() => (running ? stopTimer(task.id) : startTimer(task.id))}
          >
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
        )}

        <button
          onClick={() => removeDailyTask(task.id)}
          aria-label="Remove"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      {task.trackingType === "Time" && (
        <div className="mt-3 pl-11">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-foreground"
              animate={{ width: `${Math.min(100, pct)}%` }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatMinutes(liveValue)} / {formatMinutes(task.targetValue)}
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                aria-label="Hours logged"
                inputMode="numeric"
                min="0"
                type="number"
                placeholder="HH"
                value={hours}
                onChange={(e) => onTime(e.target.value, minutes)}
                className={`${numberField} w-14`}
              />
              <Input
                aria-label="Minutes logged"
                inputMode="numeric"
                min="0"
                type="number"
                placeholder="MM"
                value={minutes}
                onChange={(e) => onTime(hours, e.target.value)}
                className={`${numberField} w-14`}
              />
            </div>
          </div>
        </div>
      )}

      {task.trackingType === "Count" && (
        <div className="mt-3 flex items-center gap-2 pl-11">
          <Input
            aria-label="Count logged"
            inputMode="numeric"
            min="0"
            type="number"
            placeholder="Count"
            value={count}
            onChange={(e) => onCount(e.target.value)}
            className={`${numberField} w-24`}
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            of {task.targetValue}
          </span>
        </div>
      )}
    </motion.li>
  );
}

function MyDay() {
  useDailyReset();
  const hydrated = useHydrated();
  const syncTimers = useStore((s) => s.syncTimers);
  const all = useStore((s) => s.dailyTasks);
  const dailyTasks = hydrated ? all : [];
  const doing = dailyTasks.filter((t) => t.status === "Doing");
  const done = dailyTasks.filter((t) => t.status === "Done");

  useEffect(() => {
    // Nothing to fold here: timers keep running across reloads and are only
    // folded when paused, so the live display stays accurate.
    void syncTimers;
  }, [syncTimers]);

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-28 pt-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">My Day</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
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
