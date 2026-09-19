import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Recurrence = "Once" | "Repetitive";
export type TrackingType = "Simple" | "Time" | "Count";

export interface HistoryEntry {
  date: string;
  amountLogged: number;
}

export interface GlobalTask {
  id: string;
  title: string;
  recurrence: Recurrence;
  baseType: TrackingType;
  expiresAt?: string; // ISO date, only for "Once"
  isGloballyCompleted: boolean;
  history: HistoryEntry[];
}

export interface DailyTask {
  id: string;
  globalTaskId: string;
  trackingType: TrackingType;
  targetValue: number;
  currentValue: number;
  status: "Doing" | "Done";
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** The "logical day" key: a day starts at 04:00 local time. */
export function dayKey(d = new Date()): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

interface State {
  globalTasks: GlobalTask[];
  dailyTasks: DailyTask[];
  lastResetDate: string;
  addGlobalTask: (t: Omit<GlobalTask, "id" | "isGloballyCompleted" | "history">) => void;
  removeGlobalTask: (id: string) => void;
  completeGlobalTask: (id: string) => void;
  addToMyDay: (globalTaskId: string, trackingType: TrackingType, targetValue: number) => void;
  logDailyProgress: (id: string, amount: number) => void;
  toggleDailyDone: (id: string) => void;
  removeDailyTask: (id: string) => void;
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
  },
  {
    id: uid(),
    title: "File tax documents",
    recurrence: "Once",
    baseType: "Simple",
    expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    isGloballyCompleted: false,
    history: [],
  },
  {
    id: uid(),
    title: "Deep work",
    recurrence: "Repetitive",
    baseType: "Time",
    isGloballyCompleted: false,
    history: [],
  },
  {
    id: uid(),
    title: "Push-ups",
    recurrence: "Repetitive",
    baseType: "Count",
    isGloballyCompleted: false,
    history: [],
  },
  {
    id: uid(),
    title: "Make the bed",
    recurrence: "Repetitive",
    baseType: "Simple",
    isGloballyCompleted: false,
    history: [],
  },
];

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
            { ...t, id: uid(), isGloballyCompleted: false, history: [] },
          ],
        })),

      removeGlobalTask: (id) =>
        set((s) => ({
          globalTasks: s.globalTasks.filter((g) => g.id !== id),
          dailyTasks: s.dailyTasks.filter((d) => d.globalTaskId !== id),
        })),

      completeGlobalTask: (id) =>
        set((s) => ({
          globalTasks: s.globalTasks.map((g) =>
            g.id === id ? { ...g, isGloballyCompleted: true } : g,
          ),
        })),

      addToMyDay: (globalTaskId, trackingType, targetValue) =>
        set((s) => ({
          dailyTasks: [
            ...s.dailyTasks,
            {
              id: uid(),
              globalTaskId,
              trackingType,
              targetValue: trackingType === "Simple" ? 1 : targetValue,
              currentValue: 0,
              status: "Doing",
            },
          ],
        })),

      logDailyProgress: (id, amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        set((s) => {
          const dailyTask = s.dailyTasks.find((d) => d.id === id);
          if (!dailyTask || dailyTask.trackingType === "Simple") return s;
          const value = Math.min(dailyTask.currentValue + amount, dailyTask.targetValue);
          return {
            dailyTasks: s.dailyTasks.map((d) =>
              d.id === id
                ? { ...d, currentValue: value, status: value >= d.targetValue ? "Done" : "Doing" }
                : d,
            ),
            globalTasks: s.globalTasks.map((g) =>
              g.id === dailyTask.globalTaskId
                ? {
                    ...g,
                    history: [...g.history, { date: dayKey(), amountLogged: amount }],
                  }
                : g,
            ),
          };
        });
      },

      toggleDailyDone: (id) =>
        set((s) => ({
          dailyTasks: s.dailyTasks.map((d) => {
            if (d.id !== id || d.trackingType !== "Simple") return d;
            const done = d.status === "Done";
            return {
              ...d,
              status: done ? "Doing" : "Done",
              currentValue: done ? 0 : d.targetValue,
            };
          }),
          globalTasks: s.globalTasks.map((g) => {
            const dailyTask = s.dailyTasks.find((d) => d.id === id);
            if (!dailyTask || dailyTask.trackingType !== "Simple" || g.id !== dailyTask.globalTaskId) {
              return g;
            }
            if (dailyTask.status === "Done") {
              const index = g.history.map((entry) => entry.date).lastIndexOf(dayKey());
              if (index < 0) return g;
              return { ...g, history: g.history.filter((_, i) => i !== index) };
            }
            return { ...g, history: [...g.history, { date: dayKey(), amountLogged: 1 }] };
          }),
        })),

      removeDailyTask: (id) =>
        set((s) => ({ dailyTasks: s.dailyTasks.filter((d) => d.id !== id) })),

      checkReset: () => {
        const today = dayKey();
        if (get().lastResetDate !== today) {
          set({ dailyTasks: [], lastResetDate: today });
        }
      },
    }),
    {
      name: "tweek-todo-v1",
      version: 2,
      migrate: (persisted) => {
        const saved = persisted as Partial<State> | undefined;
        return {
          ...saved,
          globalTasks: (saved?.globalTasks ?? seedGlobal).map((task) => ({
            ...task,
            history: Array.isArray(task.history) ? task.history : [],
          })),
        } as State;
      },
    },
  ),
);

export function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
