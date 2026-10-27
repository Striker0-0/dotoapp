import { useEffect } from "react";
import { runAutoPlan } from "@/lib/autoplan";
import { CALENDAR_EVENT } from "@/lib/calendar";
import { syncNotifications } from "@/lib/notify";
import { useStore } from "@/lib/store";

/** Runs the calendar auto-plan and refreshes the phone reminders when the app opens, comes back to the front, and every 30 minutes. */
export function AutoPlanner() {
  useEffect(() => {
    let stopped = false;
    const run = () => {
      if (!stopped) void runAutoPlan().then(() => syncNotifications());
    };

    // Reminders follow your data: rebuilt a few seconds after anything changes.
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const resync = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!stopped) void syncNotifications();
      }, 3000);
    };
    const unsubscribe = useStore.subscribe(resync);
    window.addEventListener(CALENDAR_EVENT, resync);

    let off: (() => void) | undefined;
    if (useStore.persist.hasHydrated()) run();
    else off = useStore.persist.onFinishHydration(run);

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(run, 30 * 60 * 1000);

    return () => {
      stopped = true;
      clearTimeout(debounce);
      unsubscribe();
      window.removeEventListener(CALENDAR_EVENT, resync);
      off?.();
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  return null;
}
