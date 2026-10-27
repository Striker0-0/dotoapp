import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DayEditor } from "@/components/DayEditor";
import { GoalProgress } from "@/components/GoalProgress";
import { Heatmap } from "@/components/Heatmap";
import { useHydrated } from "@/components/useHydrated";
import {
  aggregatedHistory,
  formatMinutes,
  useStore,
  type GlobalTask,
  type TrackingType,
} from "@/lib/store";
import {
  addDays,
  dailyTotals,
  formatAmount,
  mergeTotals,
  sumRange,
  todayYmd,
  weekBounds,
} from "@/lib/stats";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Estatísticas · Slate" },
      { name: "description", content: "Mapa de calor diário do seu tempo e metas semanais." },
    ],
  }),
  component: Stats,
});

const label = "mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

function Tile({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Stats() {
  const hydrated = useHydrated();
  const stored = useStore((s) => s.globalTasks);
  const globalTasks = useMemo(() => (hydrated ? stored : []), [hydrated, stored]);

  const [pick, setPick] = useState("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => setSelectedDay(null), [pick]);

  const task: GlobalTask | null = globalTasks.find((g) => g.id === pick) ?? null;
  const children = task ? globalTasks.filter((g) => g.parentId === task.id) : [];
  const isParent = children.length > 0;

  const type: TrackingType = task
    ? isParent
      ? children.some((c) => c.baseType === "Time")
        ? "Time"
        : "Count"
      : task.baseType
    : "Time";

  const values = useMemo(() => {
    if (task) return dailyTotals(aggregatedHistory(task, globalTasks));
    return mergeTotals(
      globalTasks.filter((g) => g.baseType === "Time").map((g) => dailyTotals(g.history)),
    );
  }, [task, globalTasks]);

  const today = todayYmd();
  const thisWeek = weekBounds(0);
  const lastWeek = weekBounds(1);
  const week = sumRange(values, thisWeek.start, thisWeek.end);
  const prev = sumRange(values, lastWeek.start, lastWeek.end);
  const month = sumRange(values, addDays(today, -29), today);
  const fmt = (n: number) => formatAmount(type, n);
  const avg = month.days > 0 ? month.amount / month.days : 0;

  const goalTasks = globalTasks.filter(
    (g) => g.recurrence === "Repetitive" && g.weeklyGoal && !g.isGloballyCompleted,
  );

  const dayBreakdown = selectedDay
    ? globalTasks
        .filter((g) => g.baseType === "Time")
        .map((g) => ({ g, v: dailyTotals(g.history).get(selectedDay) ?? 0 }))
        .filter((x) => x.v > 0)
    : [];

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-28 pt-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Toque em um dia para ver. Peça ao Gemini para somar qualquer período.
        </p>
      </header>

      <section className="mb-8">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label="Tarefa a mostrar"
          className="mb-4 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
        >
          <option value="all" className="bg-card text-foreground">
            Todas as tarefas com tempo
          </option>
          {globalTasks.map((g) => (
            <option key={g.id} value={g.id} className="bg-card text-foreground">
              {g.parentId ? "↳ " : ""}
              {g.title}
            </option>
          ))}
        </select>

        <Heatmap
          values={values}
          weeks={22}
          format={fmt}
          selected={selectedDay}
          onSelect={(d) => setSelectedDay((cur) => (cur === d ? null : d))}
        />

        {selectedDay && task && !isParent && <DayEditor task={task} date={selectedDay} />}
        {selectedDay && task && isParent && (
          <p className="mt-3 text-xs text-muted-foreground">Abra uma subtarefa para editar os dias.</p>
        )}
        {selectedDay && !task && (
          <div className="mt-3 rounded-lg border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
              <span className="ml-2 text-foreground">{fmt(values.get(selectedDay) ?? 0) || "nada registrado"}</span>
            </p>
            {dayBreakdown.length > 0 && (
              <ul className="mt-2 space-y-1">
                {dayBreakdown.map(({ g, v }) => (
                  <li key={g.id} className="flex justify-between text-xs">
                    <span className="truncate">{g.title}</span>
                    <span className="ml-3 tabular-nums text-muted-foreground">{formatMinutes(v)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Escolha uma tarefa acima para editar um dia.
            </p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <p className={label}>Totais</p>
        <div className="grid grid-cols-2 gap-3">
          <Tile title="Esta semana" value={fmt(week.amount) || "0"} sub={`${week.days} dias ativos`} />
          <Tile title="Semana passada" value={fmt(prev.amount) || "0"} sub={`${prev.days} dias ativos`} />
          <Tile title="Últimos 30 dias" value={fmt(month.amount) || "0"} sub={`${month.days} dias ativos`} />
          <Tile
            title="Média por dia ativo"
            value={avg > 0 ? fmt(avg) : "0"}
            sub="last 30 days"
          />
        </div>
      </section>

      <section>
        <p className={label}>Metas semanais</p>
        {goalTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma meta ainda. Adicione ao criar ou editar uma tarefa recorrente.
          </p>
        ) : (
          <div className="space-y-4">
            {goalTasks.map((g) => (
              <div key={g.id}>
                <p className="mb-1 text-sm">{g.title}</p>
                <GoalProgress task={g} />
              </div>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
