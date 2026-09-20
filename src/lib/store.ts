import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Recurrence = "Once" | "Repetitive";
export type TrackingType = "Simple" | "Time" | "Count";

export interface HistoryEntry {
  id: string;
  date: string;
  amountLogged: number;
  dailyTaskId?: string;
}

export interface GlobalTask {
  id: string;
  title: string;
  recurrence: Recurrence;
  baseType: TrackingType;
  expiresAt?: string; // ISO date, only for "Once"
  isGloballyCompleted: boolean;
  history: HistoryEntry[];
  parentId?: string | null;
}

export interface DailyTask {
  id: string;
  globalTaskId: string;
  trackingType: TrackingType;
  targetValue: number;
  currentValue: number;
  status: "Doing" | "Done";
  timerStartTime?: number | null;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** The "logical day" key: a day starts at 04:00 local time. */
export function dayKey(d = new Date()): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

/** Day keys for today and the previous two days (editable window). */
export function recentDayKeys(): string[] {
  const now = Date.now();
  return [0, 1, 2].map((i) => dayKey(new Date(now - i * 864e5)));
}

interface State {
  globalTasks: GlobalTask[];
  dailyTasks: DailyTask[];
  lastResetDate: string;
  addGlobalTask: (
    t: Omit<GlobalTask, "id" | "isGloballyCompleted" | "history">,
  ) => void;
  removeGlobalTask: (id: string) => void;
  completeGlobalTask: (id: string) => void;
  moveGlobalTask: (id: string, direction: -1 | 1) => void;
  addToMyDay: (globalTaskId: string, trackingType: TrackingType, targetValue: number) => void;
  setDailyProgress: (id: string, value: number) => void;
  toggleDailyDone: (id: string) => void;
  removeDailyTask: (id: string) => void;
  startTimer: (id: string) => void;
  stopTimer: (id: string) => void;
  syncTimers: () => void;
  updateHistoryEntry: (globalTaskId: string, entryId: string, amount: number) => void;
  removeHistoryEntry: (globalTaskId: string, entryId: string) => void;
  checkReset: () => void;
}

const seedGlobal: GlobalTask[] = [
  {
    id: uid(),
    title: "Read Atomic Habits",
    recurrence: "Once",
    baseType: "Time",
    expiresAt: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    isGloballyCompleted: false,
    history: [],
    parentId: null,
  },
  {
    id: uid(),
    title: "File tax documents",
    recurrence: "Once",
    baseType: "Simple",
    expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    isGloballyCompleted: false,
    history: [],
    parentId: null,
  },
  {
    id: uid(),
    title: "Deep work",
    recurrence: "Repetitive",
    baseType: "Time",
    isGloballyCompleted: false,
    history: [],
    parentId: null,
  },
  {
    id: uid(),
    title: "Push-ups",
    recurrence: "Repetitive",
    baseType: "Count",
    isGloballyCompleted: false,
    history: [],
    parentId: null,
  },
  {
    id: uid(),
    title: "Make the bed",
    recurrence: "Repetitive",
    baseType: "Simple",
    isGloballyCompleted: false,
    history: [],
    parentId: null,
  },
];

/** Upserts today's history entry for a daily task on its global task. */
function writeHistory(
  tasks: GlobalTask[],
  globalTaskId: string,
  dailyTaskId: string,
  amount: number,
): GlobalTask[] {
  const today = dayKey();
  return tasks.map((g) => {
    if (g.id !== globalTaskId) return g;
    const index = g.history.findIndex(
      (e) => e.dailyTaskId === dailyTaskId && e.date === today,
    );
    if (amount <= 0) {
      return index < 0 ? g : { ...g, history: g.history.filter((_, i) => i !== index) };
    }
    if (index < 0) {
      return {
        ...g,
        history: [...g.history, { id: uid(), date: today, amountLogged: amount, dailyTaskId }],
      };
    }
    return {
      ...g,
      history: g.history.map((e, i) => (i === index ? { ...e, amountLogged: amount } : e)),
    };
  });
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      globalTasks: seedGlobal,
      dailyTasks: [],
      lastResetDate: dayKey(),

      addGlobalTask: (t) =>
        set((s) => ({
          globalTasks: [
            ...s.globalTasks,
            { parentId: null, ...t, id: uid(), isGloballyCompleted: false, history: [] },
          ],
        })),

      removeGlobalTask: (id) =>
        set((s) => {
          const ids = new Set([id, ...s.globalTasks.filter((g) => g.parentId === id).map((g) => g.id)]);
          return {
            globalTasks: s.globalTasks.filter((g) => !ids.has(g.id)),
            dailyTasks: s.dailyTasks.filter((d) => !ids.has(d.globalTaskId)),
          };
        }),

      completeGlobalTask: (id) =>
        set((s) => ({
          globalTasks: s.globalTasks.map((g) =>
            g.id === id ? { ...g, isGloballyCompleted: true } : g,
          ),
        })),

      moveGlobalTask: (id, direction) =>
        set((s) => {
          const tasks = [...s.globalTasks];
          const index = tasks.findIndex((g) => g.id === id);
          if (index < 0) return s;
          const self = tasks[index]!;
          const isSibling = (g: GlobalTask) =>
            g.recurrence === self.recurrence &&
            (g.parentId ?? null) === (self.parentId ?? null) &&
            !g.isGloballyCompleted;
          let target = -1;
          if (direction === -1) {
            for (let i = index - 1; i >= 0; i--) if (isSibling(tasks[i]!)) { target = i; break; }
          } else {
            for (let i = index + 1; i < tasks.length; i++) if (isSibling(tasks[i]!)) { target = i; break; }
          }
          if (target < 0) return s;
          [tasks[index], tasks[target]] = [tasks[target]!, tasks[index]!];
          return { globalTasks: tasks };
        }),

      addToMyDay: (globalTaskId, trackingType, targetValue) =>
        set((s) => {
          if (s.dailyTasks.some((d) => d.globalTaskId === globalTaskId)) return s;
          return {
            dailyTasks: [
              ...s.dailyTasks,
              {
                id: uid(),
                globalTaskId,
                trackingType,
                targetValue: trackingType === "Simple" ? 1 : targetValue,
                currentValue: 0,
                status: "Doing",
                timerStartTime: null,
              },
            ],
          };
        }),

      setDailyProgress: (id, value) => {
        if (!Number.isFinite(value) || value < 0) return;
        set((s) => {
          const daily = s.dailyTasks.find((d) => d.id === id);
          if (!daily || daily.trackingType === "Simple") return s;
          const done = value >= daily.targetValue;
          const global = s.globalTasks.find((g) => g.id === daily.globalTaskId);
          let globalTasks = writeHistory(s.globalTasks, daily.globalTaskId, daily.id, value);
          if (done && global?.recurrence === "Once") {
            globalTasks = globalTasks.map((g) =>
              g.id === global.id ? { ...g, isGloballyCompleted: true } : g,
            );
          }
          return {
            dailyTasks: s.dailyTasks.map((d) =>
              d.id === id
                ? { ...d, currentValue: value, status: done ? "Done" : "Doing" }
                : d,
            ),
            globalTasks,
          };
        });
      },

      toggleDailyDone: (id) =>
        set((s) => {
          const daily = s.dailyTasks.find((d) => d.id === id);
          if (!daily || daily.trackingType !== "Simple") return s;
          const wasDone = daily.status === "Done";
          const global = s.globalTasks.find((g) => g.id === daily.globalTaskId);
          let globalTasks = writeHistory(
            s.globalTasks,
            daily.globalTaskId,
            daily.id,
            wasDone ? 0 : 1,
          );
          if (!wasDone && global?.recurrence === "Once") {
            globalTasks = globalTasks.map((g) =>
              g.id === global.id ? { ...g, isGloballyCompleted: true } : g,
            );
          }
          return {
            dailyTasks: s.dailyTasks.map((d) =>
              d.id === id
                ? {
                    ...d,
                    status: wasDone ? "Doing" : "Done",
                    currentValue: wasDone ? 0 : d.targetValue,
                  }
                : d,
            ),
            globalTasks,
          };
        }),

      removeDailyTask: (id) =>
        set((s) => ({ dailyTasks: s.dailyTasks.filter((d) => d.id !== id) })),

      startTimer: (id) =>
        set((s) => ({
          dailyTasks: s.dailyTasks.map((d) =>
            d.id === id ? { ...d, timerStartTime: Date.now() } : d,
          ),
        })),

      stopTimer: (id) => {
        const daily = get().dailyTasks.find((d) => d.id === id);
        if (!daily?.timerStartTime) return;
        const elapsed = (Date.now() - daily.timerStartTime) / 60000;
        set((s) => ({
          dailyTasks: s.dailyTasks.map((d) =>
            d.id === id ? { ...d, timerStartTime: null } : d,
          ),
        }));
        get().setDailyProgress(id, Math.round((daily.currentValue + elapsed) * 100) / 100);
      },

      /** Folds any timer that was running while the app was closed. */
      syncTimers: () => {
        const running = get().dailyTasks.filter((d) => d.timerStartTime);
        running.forEach((d) => get().stopTimer(d.id));
      },

      updateHistoryEntry: (globalTaskId, entryId, amount) =>
        set((s) => ({
          globalTasks: s.globalTasks.map((g) =>
            g.id === globalTaskId
              ? {
                  ...g,
                  history: g.history.map((e) =>
                    e.id === entryId ? { ...e, amountLogged: Math.max(0, amount) } : e,
                  ),
                }
              : g,
          ),
        })),

      removeHistoryEntry: (globalTaskId, entryId) =>
        set((s) => ({
          globalTasks: s.globalTasks.map((g) =>
            g.id === globalTaskId
              ? { ...g, history: g.history.filter((e) => e.id !== entryId) }
              : g,
          ),
        })),

      checkReset: () => {
        const today = get().lastResetDate;
        if (today !== dayKey()) {
          get().syncTimers();
          set({ dailyTasks: [], lastResetDate: dayKey() });
        }
      },
    }),
    {
      name: "tweek-todo-v1",
      version: 3,
      migrate: (persisted) => {
        const saved = persisted as Partial<State> | undefined;
        return {
          ...saved,
          globalTasks: (saved?.globalTasks ?? seedGlobal).map((task) => ({
            ...task,
            parentId: task.parentId ?? null,
            history: (Array.isArray(task.history) ? task.history : []).map((entry) => ({
              ...entry,
              id: entry.id ?? uid(),
            })),
          })),
          dailyTasks: (saved?.dailyTasks ?? []).map((d) => ({
            ...d,
            timerStartTime: d.timerStartTime ?? null,
          })),
        } as State;
      },
    },
  ),
);

export function formatMinutes(mins: number) {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** All history of a task, including its subtasks. */
export function aggregatedHistory(task: GlobalTask, all: GlobalTask[]): HistoryEntry[] {
  const children = all.filter((g) => g.parentId === task.id);
  return [...task.history, ...children.flatMap((c) => c.history)];
}
