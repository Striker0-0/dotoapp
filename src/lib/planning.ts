import type { CalendarEvent } from "@/lib/calendar";
import type { AutoPlanSettings, DailyTask, GlobalTask } from "@/lib/store";
import { formatMinutes } from "@/lib/store";
import { addDays, dailyTotals, parseYmd, weekBounds, weekProgress } from "@/lib/stats";

/**
 * Rules that run in the app with no AI calls: what to add to My Day from the
 * calendar, and what to warn the user about.
 */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the title starts a word with one of the keywords ("test" matches "Test 2", not "latest"). */
export function isExam(title: string, keywords: string): boolean {
  const words = keywords
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escapeRegex).join("|")})`, "iu");
  return re.test(title);
}

export const timeText = (e: CalendarEvent) =>
  e.allDay
    ? ""
    : `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")}`;

export type PlanAction =
  | { kind: "event"; key: string; title: string; date: string }
  | { kind: "study"; key: string; title: string; date: string; minutes: number };

/** What the auto-plan should add right now. Anything already handled is skipped. */
export function planActions(
  events: CalendarEvent[],
  today: string,
  settings: AutoPlanSettings,
  handled: ReadonlySet<string>,
): PlanAction[] {
  const out: PlanAction[] = [];
  const seen = new Set<string>();
  const daysBefore = Math.min(14, Math.max(1, Math.round(settings.daysBefore)));
  const minutes = Math.min(1440, Math.max(5, Math.round(settings.studyMinutes)));

  for (const e of events) {
    if (settings.addEvents && e.date === today && (!e.allDay || settings.includeAllDay !== false)) {
      const key = `ev:${e.id}`;
      if (!handled.has(key) && !seen.has(key)) {
        seen.add(key);
        const t = timeText(e);
        out.push({ kind: "event", key, title: t ? `${t} · ${e.title}` : e.title, date: e.date });
      }
    }
    if (
      settings.examPrep &&
      e.date > today &&
      today >= addDays(e.date, -daysBefore) &&
      isExam(e.title, settings.examKeywords)
    ) {
      const key = `study:${e.id}`;
      if (!handled.has(key) && !seen.has(key)) {
        seen.add(key);
        out.push({ kind: "study", key, title: `Study: ${e.title}`, date: e.date, minutes });
      }
    }
  }
  return out;
}

export interface Insight {
  id: string;
  level: "warn" | "info";
  text: string;
}

const daysUntil = (from: string, to: string) =>
  Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 864e5);

const names = (list: GlobalTask[]) => {
  const shown = list.slice(0, 3).map((g) => g.title);
  return shown.join(", ") + (list.length > 3 ? ` +${list.length - 3}` : "");
};

export function computeInsights(input: {
  globalTasks: GlobalTask[];
  dailyTasks: DailyTask[];
  events: CalendarEvent[];
  today: string;
  settings: AutoPlanSettings;
}): Insight[] {
  const { globalTasks, dailyTasks, events, today, settings } = input;
  const out: Insight[] = [];
  const open = globalTasks.filter((g) => !g.isGloballyCompleted);
  const planned = new Set(dailyTasks.map((d) => d.globalTaskId));

  const overdue = open.filter(
    (g) => g.recurrence === "Once" && g.expiresAt && g.expiresAt < today && g.auto !== "event",
  );
  if (overdue.length > 0) {
    out.push({
      id: "overdue",
      level: "warn",
      text: `${overdue.length} overdue: ${names(overdue)}`,
    });
  }

  for (const [offset, when] of [
    [0, "today"],
    [1, "tomorrow"],
  ] as const) {
    const date = addDays(today, offset);
    const due = open.filter(
      (g) =>
        g.recurrence === "Once" &&
        g.expiresAt === date &&
        !planned.has(g.id) &&
        g.auto !== "event",
    );
    if (due.length > 0) {
      out.push({
        id: `due-${offset}`,
        level: offset === 0 ? "warn" : "info",
        text: `Due ${when}, not in My Day: ${names(due)}`,
      });
    }
  }

  const weekEnd = weekBounds(0).end;
  for (const g of open) {
    if (!g.weeklyGoal || g.recurrence !== "Repetitive") continue;
    const p = weekProgress(g, 0);
    if (p.met) continue;
    const loggedToday = (dailyTotals(g.history).get(today) ?? 0) > 0;
    // Days still available after today, plus today if nothing is logged yet.
    const left = daysUntil(today, weekEnd) + (loggedToday ? 0 : 1);
    const need = p.target - p.done;
    if (g.weeklyGoal.kind === "days") {
      if (need > left) {
        out.push({
          id: `goal-${g.id}`,
          level: "warn",
          text: `${g.title}: can't reach ${p.target} days this week (${p.days} so far, ${left} days left)`,
        });
      } else if (need === left && need > 0) {
        out.push({
          id: `goal-${g.id}`,
          level: "warn",
          text: `${g.title}: needs every remaining day this week (${need})`,
        });
      }
    } else if (left <= 3) {
      const fmt = (n: number) => (g.baseType === "Time" ? formatMinutes(n) : `${Math.round(n)} reps`);
      out.push({
        id: `goal-${g.id}`,
        level: left <= 1 ? "warn" : "info",
        text:
          left <= 0
            ? `${g.title}: week ends with ${fmt(need)} to go`
            : `${g.title}: ${fmt(need)} to go, ${fmt(need / left)} a day for ${left} ${left === 1 ? "day" : "days"}`,
      });
    }
  }

  for (const e of events) {
    if (!isExam(e.title, settings.examKeywords)) continue;
    const n = daysUntil(today, e.date);
    if (n < 0 || n > 3) continue;
    out.push({
      id: `exam-${e.id}`,
      level: n <= 1 ? "warn" : "info",
      text: `${e.title} ${n === 0 ? "is today" : n === 1 ? "is tomorrow" : `in ${n} days`}`,
    });
  }

  const todays = events.filter((e) => e.date === today);
  if (todays.length > 0) {
    const shown = todays
      .slice(0, 3)
      .map((e) => [timeText(e), e.title].filter(Boolean).join(" "))
      .join(", ");
    out.push({
      id: "today-events",
      level: "info",
      text: `Calendar today: ${shown}${todays.length > 3 ? ` +${todays.length - 3} more` : ""}`,
    });
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "warn" ? -1 : 1)).slice(0, 7);
}
