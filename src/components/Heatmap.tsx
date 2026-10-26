import { addDays, parseYmd, todayYmd } from "@/lib/stats";

const LEVELS = ["bg-muted", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];

function level(v: number, max: number): number {
  if (v <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((v / max) * 4)));
}

/**
 * Calendar heatmap: one column per week (Mon at the top), newest week on the
 * right. `values` is keyed by padded YYYY-MM-DD.
 */
export function Heatmap({
  values,
  weeks = 18,
  format,
  selected,
  onSelect,
}: {
  values: Map<string, number>;
  weeks?: number;
  format: (n: number) => string;
  selected?: string | null;
  onSelect?: (date: string) => void;
}) {
  const today = todayYmd();
  const t = parseYmd(today);
  const thisMonday = addDays(today, -((t.getDay() + 6) % 7));
  const first = addDays(thisMonday, -(weeks - 1) * 7);

  const cols = Array.from({ length: weeks }, (_, c) => addDays(first, c * 7));
  const shown = new Set<string>();
  for (let i = 0; i < weeks * 7; i++) shown.add(addDays(first, i));
  let max = 0;
  for (const [date, v] of values) if (shown.has(date) && v > max) max = v;

  return (
    <div>
      {/* month labels */}
      <div className="mb-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cols.map((monday) => {
          const d = parseYmd(monday);
          return (
            <span key={monday} className="overflow-visible whitespace-nowrap text-[9px] text-muted-foreground">
              {d.getDate() <= 7 ? d.toLocaleDateString(undefined, { month: "short" }) : ""}
            </span>
          );
        })}
      </div>

      <div
        className="grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {cols.flatMap((monday) =>
          Array.from({ length: 7 }, (_, r) => {
            const date = addDays(monday, r);
            if (date > today) return <span key={date} className="aspect-square" />;
            const v = values.get(date) ?? 0;
            const isToday = date === today;
            const isSelected = selected === date;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelect?.(date)}
                aria-label={`${date}: ${v > 0 ? format(v) : "nothing"}`}
                className={`aspect-square rounded-[3px] ${LEVELS[level(v, max)]} ${
                  isSelected
                    ? "outline outline-2 outline-offset-1 outline-foreground"
                    : isToday
                      ? "ring-1 ring-foreground/60"
                      : ""
                }`}
              />
            );
          }),
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less
        {LEVELS.map((c) => (
          <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
        ))}
        More
      </div>
    </div>
  );
}
