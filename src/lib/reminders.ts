import type { CalendarEvent } from "@/lib/calendar";
import { isExam, timeText } from "@/lib/planning";
import { addDays, dailyTotals, normDate, parseYmd, progressLabel, weekBounds, weekProgress } from "@/lib/stats";
import { dayKey, type AutoPlanSettings, type GlobalTask, type NotifySettings } from "@/lib/store";

/**
 * Builds the phone reminders from what the app already knows. The phone fires them
 * even when the app is closed, so they are planned a week ahead and rebuilt every
 * time the app runs or your data changes. No AI calls.
 */

export interface Reminder {
  id: number;
  at: Date;
  title: string;
  /** One line (collapsed notification). */
  body: string;
  /** All lines (expanded notification). */
  detail: string;
}

const DAYS_AHEAD = 7;

/** "08:30" -> [8, 30], falling back to the default for a bad value. */
export function parseClock(value: string, fallback: [number, number]): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? [h, min] : fallback;
}

function at(date: string, [h, m]: [number, number]): Date {
  const d = parseYmd(date);
  d.setHours(h, m, 0, 0);
  return d;
}

const names = (list: GlobalTask[]) => {
  const shown = list.slice(0, 3).map((g) => g.title);
  return shown.join(", ") + (list.length > 3 ? ` +${list.length - 3}` : "");
};

const whenText = (n: number) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);

const daysBetween = (a: string, b: string) =>
  Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 864e5);

export function buildReminders(input: {
  now: Date;
  globalTasks: GlobalTask[];
  events: CalendarEvent[];
  autoplan: AutoPlanSettings;
  notify: NotifySettings;
}): Reminder[] {
  const { now, globalTasks, events, autoplan, notify } = input;
  if (!notify.enabled) return [];

  const today = normDate(dayKey(now)) ?? "";
  const morning = parseClock(notify.morning, [8, 0]);
  const evening = parseClock(notify.evening, [19, 0]);
  const daysBefore = Math.min(14, Math.max(1, Math.round(autoplan.daysBefore)));
  const minutes = Math.min(1440, Math.max(5, Math.round(autoplan.studyMinutes)));
  const open = globalTasks.filter((g) => !g.isGloballyCompleted);
  const weekEnd = weekBounds(0).end;

  // Exams with their study task state.
  const exams = events
    .filter((e) => isExam(e.title, autoplan.examKeywords))
    .map((e) => ({
      event: e,
      studied: globalTasks.some(
        (g) => g.auto === "study" && g.isGloballyCompleted && g.title === `Estudar: ${e.title}`,
      ),
    }));

  const out: Omit<Reminder, "id">[] = [];
  const push = (when: Date, title: string, lines: string[]) => {
    if (lines.length === 0 || when.getTime() <= input.now.getTime()) return;
    out.push({ at: when, title, body: lines.join(" · "), detail: lines.join("\n") });
  };

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = addDays(today, d);

    // Morning: what is on today.
    const morningLines: string[] = [];
    const todays = events.filter((e) => e.date === date);
    for (const e of todays.slice(0, 3)) {
      const t = timeText(e);
      morningLines.push(t ? `${t} ${e.title}` : e.title);
    }
    if (todays.length > 3) morningLines.push(`+${todays.length - 3} na agenda`);
    for (const x of exams) {
      const start = addDays(x.event.date, -daysBefore);
      if (!x.studied && date >= start && date < x.event.date) {
        morningLines.push(`Estudar hoje: ${x.event.title} (${minutes} min)`);
      }
    }
    const dueToday = open.filter(
      (g) => g.recurrence === "Once" && g.expiresAt === date && g.auto == null,
    );
    if (dueToday.length > 0) morningLines.push(`Vence hoje: ${names(dueToday)}`);
    push(at(date, morning), "Seu dia", morningLines);

    // Evening: what needs attention before tomorrow.
    const eveningLines: string[] = [];
    for (const x of exams) {
      const n = daysBetween(date, x.event.date);
      if (!x.studied && n >= 1 && n <= daysBefore) {
        eveningLines.push(`${x.event.title} ${whenText(n)} — falta estudar`);
      }
    }
    const dueTomorrow = open.filter(
      (g) => g.recurrence === "Once" && g.expiresAt === addDays(date, 1) && g.auto == null,
    );
    if (dueTomorrow.length > 0) eveningLines.push(`Vence amanhã: ${names(dueTomorrow)}`);

    if (date <= weekEnd) {
      const goals: string[] = [];
      for (const g of open) {
        if (g.recurrence !== "Repetitive" || !g.weeklyGoal) continue;
        const p = weekProgress(g, 0);
        if (p.met) continue;
        const loggedToday = (dailyTotals(g.history).get(date) ?? 0) > 0;
        // A "days" goal already counted today does not need a nudge tonight.
        if (g.weeklyGoal.kind === "days" && loggedToday && date === today) continue;
        goals.push(`Meta: ${g.title} — ${progressLabel(g, p)}`);
      }
      eveningLines.push(...goals.slice(0, 3));
    }
    push(at(date, evening), "Antes de dormir", eveningLines);
  }

  return out
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 30)
    .map((r, i) => ({ ...r, id: i + 1 }));
}
