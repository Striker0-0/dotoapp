import { Input } from "@/components/ui/input";
import { formatMinutes, type TrackingType, type WeeklyGoal } from "@/lib/store";

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs transition-colors ${
    on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
  }`;

/** Optional weekly goal: none, days per week, or an amount per week. */
export function GoalPicker({
  baseType,
  value,
  onChange,
}: {
  baseType: TrackingType;
  value: WeeklyGoal | null;
  onChange: (goal: WeeklyGoal | null) => void;
}) {
  const canAmount = baseType !== "Simple";
  // An amount goal means nothing for a Simple task.
  const goal = value?.kind === "amount" && !canAmount ? null : value;
  const unit = baseType === "Time" ? "min" : "rep.";

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">Meta semanal (opcional)</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(goal === null)} onClick={() => onChange(null)}>
          Nenhuma
        </button>
        <button
          type="button"
          className={chip(goal?.kind === "days")}
          onClick={() =>
            onChange({ kind: "days", target: goal?.kind === "days" ? goal.target : 5 })
          }
        >
          Dias por semana
        </button>
        {canAmount && (
          <button
            type="button"
            className={chip(goal?.kind === "amount")}
            onClick={() =>
              onChange({
                kind: "amount",
                target: goal?.kind === "amount" ? goal.target : baseType === "Time" ? 300 : 100,
              })
            }
          >
            {baseType === "Time" ? "Tempo por semana" : "Repetições por semana"}
          </button>
        )}
      </div>

      {goal?.kind === "days" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={chip(goal.target === n)}
              onClick={() => onChange({ kind: "days", target: n })}
            >
              {n === 7 ? "Todos os dias" : n}
            </button>
          ))}
        </div>
      )}

      {goal?.kind === "amount" && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min="1"
            inputMode="numeric"
            aria-label={`Meta semanal em ${unit}`}
            value={goal.target ? String(goal.target) : ""}
            onChange={(e) =>
              onChange({ kind: "amount", target: Math.max(0, Math.round(Number(e.target.value) || 0)) })
            }
            className="h-8 w-28 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
          />
          <span className="text-xs text-muted-foreground">
            {unit} por semana
            {baseType === "Time" && goal.target > 0 ? ` (${formatMinutes(goal.target)})` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
