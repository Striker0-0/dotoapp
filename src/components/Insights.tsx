import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/components/useHydrated";
import { CALENDAR_EVENT, cachedEvents, type CalendarEvent } from "@/lib/calendar";
import {
  askBriefing,
  briefingKey,
  getApiKey,
  getSavedBriefing,
  getSpeed,
  type BriefingInput,
} from "@/lib/gemini";
import { computeInsights } from "@/lib/planning";
import { addDays, todayYmd } from "@/lib/stats";
import { useStore } from "@/lib/store";

/**
 * Alerts for My Day. The alerts come from plain rules (free, always on). The AI
 * briefing is a single call you start yourself, and it is saved: asking again
 * with nothing changed does not call Gemini.
 */
export function Insights() {
  const hydrated = useHydrated();
  const storedTasks = useStore((s) => s.globalTasks);
  const storedDaily = useStore((s) => s.dailyTasks);
  const memory = useStore((s) => s.memory);
  const autoplan = useStore((s) => s.autoplan);
  const globalTasks = hydrated ? storedTasks : [];
  const dailyTasks = hydrated ? storedDaily : [];

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [briefing, setBriefing] = useState<{ key: string; text: string; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const read = () => {
      const today = todayYmd();
      setEvents(cachedEvents(today, addDays(today, 7)));
    };
    read();
    setBriefing(getSavedBriefing());
    window.addEventListener(CALENDAR_EVENT, read);
    return () => window.removeEventListener(CALENDAR_EVENT, read);
  }, []);

  const today = todayYmd();
  const insights = useMemo(
    () => computeInsights({ globalTasks, dailyTasks, events, today, settings: autoplan }),
    [globalTasks, dailyTasks, events, today, autoplan],
  );

  const input: BriefingInput = useMemo(
    () => ({
      globalTasks,
      dailyTasks,
      memory,
      events: events.filter((e) => e.date <= addDays(today, 3)),
      alerts: insights.map((i) => i.text),
    }),
    [globalTasks, dailyTasks, memory, events, insights, today],
  );
  const currentKey = useMemo(() => briefingKey(input), [input]);
  const fresh = briefing?.key === currentKey;

  const onBriefing = async () => {
    setError("");
    const apiKey = (await getApiKey()).trim();
    if (!apiKey) {
      setError("Adicione sua chave da API do Gemini na aba Gemini primeiro.");
      return;
    }
    setBusy(true);
    try {
      const out = await askBriefing({ apiKey, speed: getSpeed(), input });
      setBriefing({ key: out.key, text: out.text, at: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui gerar o resumo.");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) return null;

  return (
    <section className="mb-8 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Atenção</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBriefing}
          disabled={busy || fresh}
          title={fresh ? "Nada mudou desde o último resumo" : "Peça um resumo curto ao Gemini"}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "Pensando…" : fresh ? "Resumo atualizado" : briefing ? "Atualizar resumo" : "Resumo com IA"}
        </Button>
      </div>

      {insights.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nada precisa da sua atenção.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {insights.map((i) => (
            <li key={i.id} className="flex gap-2 text-sm">
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  i.level === "warn" ? "bg-destructive" : "bg-muted-foreground"
                }`}
              />
              <span className="min-w-0 break-words">{i.text}</span>
            </li>
          ))}
        </ul>
      )}

      {briefing && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="whitespace-pre-wrap text-sm">{briefing.text}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {fresh ? "Gemini" : "Gemini, antes das suas últimas mudanças"} ·{" "}
            {new Date(briefing.at).toLocaleString("pt-BR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
