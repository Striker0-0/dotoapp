import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Recurrence = "Once" | "Repetitive";
export type TrackingType = "Simple" | "Time" | "Count";

export interface GlobalTask {
  id: string;
  title: string;
  recurrence: Recurrence;
  baseType: TrackingType;
  expiresAt?: string; // ISO date, only for "Once"
  isGloballyCompleted: boolean;
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
  addGlobalTask: (t: Omit<GlobalTask, "id" | "isGloballyCompleted">) => void;
  removeGlobalTask: (id: string) => void;
  completeGlobalTask: (id: string) => void;
  addToMyDay: (globalTaskId: string, trackingType: TrackingType, targetValue: number) => void;
  updateDailyValue: (id: string, value: number) => void;
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
  },
  {
    id: uid(),
    title: "File tax documents",
    recurrence: "Once",
    baseType: "Simple",
    expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    isGloballyCompleted: false,
  },
  {
    id: uid(),
    title: "Deep work",
    recurrence: "Repetitive",
    baseType: "Time",
    isGloballyCompleted: false,
  },
  {
    id: uid(),
    title: "Push-ups",
    recurrence: "Repetitive",
    baseType: "Count",
    isGloballyCompleted: false,
  },
  {
    id: uid(),
    title: "Make the bed",
    recurrence: "Repetitive",
    baseType: "Simple",
    isGloballyCompleted: false,
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
          globalTasks: [...s.globalTasks, { ...t, id: uid(), isGloballyCompleted: false }],
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

      updateDailyValue: (id, value) =>
        set((s) => ({
          dailyTasks: s.dailyTasks.map((d) => {
            if (d.id !== id) return d;
            const v = Math.max(0, Math.min(value, d.targetValue));
            return { ...d, currentValue: v, status: v >= d.targetValue ? "Done" : "Doing" };
          }),
        })),

      toggleDailyDone: (id) =>
        set((s) => ({
          dailyTasks: s.dailyTasks.map((d) => {
            if (d.id !== id) return d;
            const done = d.status === "Done";
            return {
              ...d,
              status: done ? "Doing" : "Done",
              currentValue: done ? 0 : d.targetValue,
            };
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
    { name: "tweek-todo-v1" },
  ),
);

export function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
