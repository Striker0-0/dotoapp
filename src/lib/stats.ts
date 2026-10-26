import {
  dayKey,
  formatMinutes,
  type GlobalTask,
  type HistoryEntry,
  type TrackingType,
  type WeeklyGoal,
} from "@/lib/store";

/**
 * Date and goal math shared by the stats screens and the Gemini tools.
 * History dates are day keys like "2026-10-5" (a day starts at 04:00); here
 * everything is normalised to zero-padded "YYYY-MM-DD" so strings sort and
 * compare correctly.
 */

const pad = (n: number) => String(n).padStart(2, "0");
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-5" -> "2026-10-05". Null if it is not a date. */
export function normDate(s: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  return m ? `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}` : null;
}

export function parseYmd(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-10-05" -> "2026-10-5", the format the store writes. */
export function toStoreKey(s: string): string {
  const [y = "", m = "", d = ""] = s.split("-");
  return `${y}-${Number(m)}-${Number(d)}`;
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function todayYmd(): string {
  return normDate(dayKey()) ?? ymd(new Date());
}

/** Total logged per day, keyed by padded date. */
export function dailyTotals(history: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of history) {
    const date = normDate(e.date);
    if (!date) continue;
    out.set(date, round2((out.get(date) ?? 0) + e.amountLogged));
  }
  return out;
}

/** Sum of several tasks' daily totals (e.g. all time-tracked tasks). */
export function mergeTotals(list: Map<string, number>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of list) {
    for (const [date, v] of m) out.set(date, round2((out.get(date) ?? 0) + v));
  }
  return out;
}

export function sumRange(totals: Map<string, number>, from: string, to: string) {
  let amount = 0;
  let days = 0;
  for (const [date, v] of totals) {
    if (date < from || date > to || v <= 0) continue;
    amount += v;
    days++;
  }
  return { amount: round2(amount), days };
}

/** Monday to Sunday week, `offset` weeks back from the current one. */
export function weekBounds(offset = 0): { start: string; end: string } {
  const today = parseYmd(todayYmd());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - offset * 7);
  const start = ymd(monday);
  return { start, end: addDays(start, 6) };
}

export function unitFor(baseType: TrackingType): string {
  return baseType === "Time" ? "min" : baseType === "Count" ? "reps" : "done";
}

export function formatAmount(baseType: TrackingType, n: number): string {
  if (baseType === "Time") return formatMinutes(n);
  if (baseType === "Count") return `${Math.round(n)} reps`;
  return n >= 1 ? "done" : "";
}

/** Drops goals that make no sense for the task type. */
export function cleanGoal(goal: WeeklyGoal | null, baseType: TrackingType): WeeklyGoal | null {
  if (!goal) return null;
  const target = Math.round(goal.target);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (goal.kind === "days") return { kind: "days", target: Math.min(7, target) };
  if (baseType === "Simple") return null;
  return { kind: "amount", target };
}

export function goalLabel(goal: WeeklyGoal, baseType: TrackingType): string {
  if (goal.kind === "days") {
    return goal.target >= 7 ? "every day" : `${goal.target} ${goal.target === 1 ? "day" : "days"} a week`;
  }
  return `${formatAmount(baseType, goal.target)} a week`;
}

export interface WeekProgress {
  start: string;
  end: string;
  days: number;
  amount: number;
  goal: WeeklyGoal | null;
  done: number;
  target: number;
  ratio: number;
  met: boolean;
}

/** Progress of one task in one week, against its goal (if any). */
export function weekProgress(task: GlobalTask, offset = 0): WeekProgress {
  const { start, end } = weekBounds(offset);
  const { amount, days } = sumRange(dailyTotals(task.history), start, end);
  const goal = task.weeklyGoal ?? null;
  const done = goal?.kind === "days" ? days : amount;
  const target = goal?.target ?? 0;
  return {
    start,
    end,
    days,
    amount,
    goal,
    done,
    target,
    ratio: target > 0 ? Math.min(1, done / target) : 0,
    met: target > 0 && done >= target,
  };
}

export function progressLabel(task: GlobalTask, p: WeekProgress): string {
  if (!p.goal) return "";
  if (p.goal.kind === "days") return `${p.days}/${p.goal.target} days`;
  if (task.baseType === "Time") {
    return `${formatMinutes(p.amount)} / ${formatMinutes(p.goal.target)}`;
  }
  return `${Math.round(p.amount)}/${p.goal.target} reps`;
}
