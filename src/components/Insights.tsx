import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/components/useHydrated";
import { CALENDAR_EVENT, cachedEvents, type CalendarEvent } from "@/lib/calendar";
import { computeInsights } from "@/lib/planning";
import { addDays, todayYmd } from "@/lib/stats";
import { useStore } from "@/lib/store";

/** Alerts for My Day, from plain rules (free, no AI). */
export function Insights() {
  const hydrated = useHydrated();
  const storedTasks = useStore((s) => s.globalTasks);
  const storedDaily = useStore((s) => s.dailyTasks);
  const autoplan = useStore((s) => s.autoplan);
  const globalTasks = hydrated ? storedTasks : [];
  const dailyTasks = hydrated ? storedDaily : [];

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const read = () => {
      const today = todayYmd();
      setEvents(cachedEvents(today, addDays(today, 7)));
    };
    read();
    window.addEventListener(CALENDAR_EVENT, read);
    return () => window.removeEventListener(CALENDAR_EVENT, read);
  }, []);

  const today = todayYmd();
  const insights = useMemo(
    () => computeInsights({ globalTasks, dailyTasks, events, today, settings: autoplan }),
    [globalTasks, dailyTasks, events, today, autoplan],
  );

  if (!hydrated) return null;

  return (
    <section className="mb-8 rounded-lg border border-border p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Atenção</p>
      {insights.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nada precisa da sua atenção.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {insights.map((i) => (
            <li key={i.id} className="flex gap-2 text-sm">
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  i.level === "warn" ? "bg-destructive" : "bg-muted-foreground"
                }`}
              />
              <span className="min-w-0 break-words">{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
