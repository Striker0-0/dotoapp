import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WheelColumn, range } from "./WheelPicker";
import { useStore, type GlobalTask, type TrackingType } from "@/lib/store";

export function AddToDaySheet({
  task,
  onClose,
}: {
  task: GlobalTask | null;
  onClose: () => void;
}) {
  const addToMyDay = useStore((s) => s.addToMyDay);
  const [mode, setMode] = useState<TrackingType | null>(null);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [count, setCount] = useState(10);

  useEffect(() => {
    if (!task) return;
    setMode(task.recurrence === "Once" ? null : task.baseType);
    setHours(1);
    setMinutes(0);
    setCount(10);
  }, [task]);

  const confirm = () => {
    if (!task || !mode) return;
    const target = mode === "Time" ? hours * 60 + minutes : mode === "Count" ? count : 1;
    addToMyDay(task.id, mode, target);
    onClose();
  };

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-background px-6 pb-8 pt-3"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border" />
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Add to my day
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-tight">{task.title}</h2>

            {mode === null && (
              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">How do you want to track it today?</p>
                {(["Simple", "Time"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="w-full rounded-xl border border-border px-4 py-3.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="font-medium">{m}</span>
                    <span className="ml-2 text-muted-foreground">
                      {m === "Simple" ? "just a checkbox" : "allocate time for today"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {mode === "Time" && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <WheelColumn
                    values={range(13)}
                    value={hours}
                    onChange={setHours}
                    suffix="h"
                  />
                  <WheelColumn
                    values={range(60, 5)}
                    value={minutes}
                    onChange={setMinutes}
                    suffix="m"
                  />
                </div>
              </div>
            )}

            {mode === "Count" && (
              <div className="mt-4 flex">
                <WheelColumn values={range(200, 1, 1)} value={count} onChange={setCount} />
              </div>
            )}

            {mode && (
              <button
                onClick={confirm}
                className="mt-6 w-full rounded-xl bg-foreground py-3.5 text-sm font-medium text-background transition-opacity active:opacity-80"
              >
                Add to My Day
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
