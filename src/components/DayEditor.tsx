import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, type GlobalTask } from "@/lib/store";
import { dailyTotals, formatAmount, normDate, todayYmd, toStoreKey, unitFor } from "@/lib/stats";

const field =
  "h-8 w-24 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]";

/**
 * Edit what one task has logged on one day (tap a heatmap square).
 * Today is edited from My Day, so it is read-only here.
 */
export function DayEditor({ task, date }: { task: GlobalTask; date: string }) {
  const setHistoryForDay = useStore((s) => s.setHistoryForDay);
  const current = dailyTotals(task.history).get(normDate(date) ?? date) ?? 0;
  const [value, setValue] = useState(String(Math.round(current)));

  useEffect(() => setValue(String(Math.round(current))), [current, date]);

  const label = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const isToday = date === todayYmd();

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">
        {label}
        <span className="ml-2 text-foreground">
          {current > 0 ? formatAmount(task.baseType, current) : "nada registrado"}
        </span>
      </p>

      {isToday ? (
        <p className="mt-2 text-xs text-muted-foreground">Hoje é editado em Meu dia.</p>
      ) : task.baseType === "Simple" ? (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant={current > 0 ? "outline" : "default"}
            onClick={() => setHistoryForDay(task.id, toStoreKey(date), current > 0 ? 0 : 1)}
          >
            <Check className="size-4" /> {current > 0 ? "Desmarcar" : "Marcar como feito"}
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label={`Quantidade em ${date}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={field}
          />
          <span className="text-xs text-muted-foreground">{unitFor(task.baseType)}</span>
          <Button
            size="sm"
            onClick={() =>
              setHistoryForDay(
                task.id,
                toStoreKey(date),
                Math.min(task.baseType === "Time" ? 1440 : 100000, Math.max(0, Number(value) || 0)),
              )
            }
          >
            Salvar
          </Button>
          {current > 0 && (
            <button
              type="button"
              onClick={() => setHistoryForDay(task.id, toStoreKey(date), 0)}
              aria-label="Limpar este dia"
              className="text-muted-foreground/70 hover:text-foreground"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
