import { useRef, useState } from "react";

export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const start = () => {
    setPressing(true);
    timer.current = setTimeout(() => {
      setPressing(false);
      onLongPress();
    }, ms);
  };

  const cancel = () => {
    setPressing(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return {
    pressing,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
