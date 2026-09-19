import { useEffect, useRef } from "react";

const ITEM_H = 40;

export function WheelColumn({
  values,
  value,
  onChange,
  suffix,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, values.indexOf(value));
    el.scrollTop = idx * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
      const next = values[idx];
      if (next !== undefined && next !== value) onChange(next);
    }, 90);
  };

  return (
    <div className="relative h-[200px] flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[80px] h-[40px] rounded-lg bg-muted/60" />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-scroll"
        style={{ scrollPaddingTop: 80 }}
      >
        <div style={{ height: 80 }} />
        {values.map((v) => (
          <div
            key={v}
            className={`flex snap-start items-center justify-center text-lg tabular-nums transition-colors ${
              v === value ? "font-medium text-foreground" : "text-muted-foreground/50"
            }`}
            style={{ height: ITEM_H }}
          >
            {v}
            {suffix ? <span className="ml-1 text-xs">{suffix}</span> : null}
          </div>
        ))}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}

export const range = (n: number, step = 1, start = 0) =>
  Array.from({ length: Math.floor(n / step) }, (_, i) => start + i * step);
