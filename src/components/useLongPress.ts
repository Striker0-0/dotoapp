import { useRef, useState } from "react";

export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const start = () => {
    longPressFired.current = false;
    setPressing(true);
    timer.current = setTimeout(() => {
      setPressing(false);
      longPressFired.current = true;
      onLongPress();
    }, ms);
  };

  const cancel = () => {
    setPressing(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return {
    pressing,
    consumeLongPress: () => {
      const fired = longPressFired.current;
      longPressFired.current = false;
      return fired;
    },
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
