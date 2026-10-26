import { addDays, todayYmd } from "@/lib/stats";
import { hasCalendar, loadCalendarText, parseIcs } from "@/lib/calendar";
import { planActions } from "@/lib/planning";
import { useStore } from "@/lib/store";

export interface AutoPlanResult {
  /** Titles added to My Day this run. */
  added: string[];
  /** Events found in the next 14 days. */
  events: number;
  error?: string;
}

let inflight: Promise<AutoPlanResult> | null = null;

/**
 * Reads the linked calendar and applies the auto-plan rules. Costs no AI tokens.
 * Safe to call often: the calendar is only downloaded every 3 hours and each
 * event is only handled once. Calls overlapping in time share one run.
 */
export function runAutoPlan(force = false): Promise<AutoPlanResult> {
  if (!inflight) {
    inflight = doRun(force).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doRun(force: boolean): Promise<AutoPlanResult> {
  const none: AutoPlanResult = { added: [], events: 0 };
  // New day first, so what we add is not wiped by the 04:00 reset right after.
  useStore.getState().checkReset();

  if (!hasCalendar()) return none;

  let text: string;
  try {
    text = await loadCalendarText(force);
  } catch (e) {
    return { ...none, error: e instanceof Error ? e.message : "Couldn't read the calendar." };
  }

  const today = todayYmd();
  const events = parseIcs(text, today, addDays(today, 14));
  const state = useStore.getState();
  const actions = planActions(events, today, state.autoplan, new Set(state.autoHandled));

  const added: string[] = [];
  const keys: string[] = [];
  for (const a of actions) {
    const s = useStore.getState();
    const isStudy = a.kind === "study";
    const id = s.addGlobalTask({
      title: a.title,
      recurrence: "Once",
      baseType: isStudy ? "Time" : "Simple",
      expiresAt: a.date,
      parentId: null,
      auto: a.kind,
    });
    s.addToMyDay(id, isStudy ? "Time" : "Simple", isStudy ? a.minutes : 1);
    added.push(a.title);
    keys.push(a.key);
  }
  if (keys.length > 0) useStore.getState().markHandled(keys);

  // Auto-added event tasks that were never done are clutter once the day has passed.
  const cutoff = addDays(today, -1);
  for (const g of useStore.getState().globalTasks) {
    if (g.auto === "event" && !g.isGloballyCompleted && g.expiresAt && g.expiresAt < cutoff) {
      useStore.getState().removeGlobalTask(g.id);
    }
  }

  return { added, events: events.length };
}
