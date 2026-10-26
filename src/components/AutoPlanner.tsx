import { useEffect } from "react";
import { runAutoPlan } from "@/lib/autoplan";
import { useStore } from "@/lib/store";

/** Runs the calendar auto-plan when the app opens, comes back to the front, and every 30 minutes. */
export function AutoPlanner() {
  useEffect(() => {
    let stopped = false;
    const run = () => {
      if (!stopped) void runAutoPlan();
    };

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
      off?.();
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  return null;
}
