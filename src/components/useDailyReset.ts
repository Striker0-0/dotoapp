import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Clears My Day when the 4 AM boundary has passed since the last reset. */
export function useDailyReset() {
  const checkReset = useStore((s) => s.checkReset);

  useEffect(() => {
    checkReset();
    const onFocus = () => checkReset();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const interval = setInterval(checkReset, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
    };
  }, [checkReset]);
}
