import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { runAutoPlan } from "@/lib/autoplan";
import {
  CALENDAR_EVENT,
  clearCalendar,
  getCalendarFileName,
  getCalendarUrl,
  getDeviceSelection,
  hasCalendar,
  hasDeviceCalendar,
  saveCalendarFile,
  saveCalendarUrl,
  saveDeviceSource,
} from "@/lib/calendar";
import {
  deviceCalendarSupported,
  listDeviceCalendars,
  requestDeviceAccess,
  type DeviceCalendarInfo,
} from "@/lib/deviceCalendar";
import { useStore } from "@/lib/store";

const labelCls = "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

function Row({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url.replace(/^webcal:/i, "https:")).host;
  } catch {
    return "vinculado";
  }
}

/** Link a calendar (the phone's calendars, a private iCal address or an .ics file) and set the auto-plan rules. */
export function CalendarSettings() {
  const autoplan = useStore((s) => s.autoplan);
  const setAutoplan = useStore((s) => s.setAutoplan);

  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState(false);
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [device, setDevice] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const read = () => {
      setLinked(hasCalendar());
      setDevice(hasDeviceCalendar());
      const file = getCalendarFileName();
      const u = getCalendarUrl();
      setSource(
        hasDeviceCalendar() ? "Agenda do celular" : file ? `Arquivo: ${file}` : u ? hostOf(u) : "",
      );
    };
    read();
    window.addEventListener(CALENDAR_EVENT, read);
    return () => window.removeEventListener(CALENDAR_EVENT, read);
  }, []);

  const sync = async () => {
    setBusy(true);
    setMessage("");
    const res = await runAutoPlan(true);
    setBusy(false);
    if (res.error) setMessage(res.error);
    else {
      setMessage(
        `${res.events} ${res.events === 1 ? "evento" : "eventos"} nos próximos 14 dias.` +
          (res.added.length > 0 ? ` Adicionado ao Meu dia: ${res.added.join(", ")}.` : " Nada novo para adicionar."),
      );
    }
  };

  const onSaveUrl = async () => {
    if (!url.trim()) return;
    saveCalendarUrl(url);
    setUrl("");
    await sync();
  };

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const text = await file.text();
    if (!saveCalendarFile(file.name, text)) {
      setMessage("Este não é um arquivo de agenda (.ics) ou é grande demais para guardar.");
    } else {
      await sync();
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const connectDevice = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!(await requestDeviceAccess())) {
        setMessage("Permissão negada. Libere o acesso à agenda nas configurações do Android.");
        return;
      }
      const list = await listDeviceCalendars();
      setCalendars(list);
      setPicked(list.map((c) => c.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não consegui acessar a agenda do celular.");
    } finally {
      setBusy(false);
    }
  };

  const useDevice = async () => {
    // Every calendar ticked means "all", so calendars added later are included too.
    saveDeviceSource(calendars && picked.length === calendars.length ? null : picked);
    setCalendars(null);
    await sync();
  };

  const editDevice = async () => {
    setBusy(true);
    try {
      const list = await listDeviceCalendars();
      const current = getDeviceSelection();
      setCalendars(list);
      setPicked(current ?? list.map((c) => c.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não consegui acessar a agenda do celular.");
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left"
      >
        <span className={labelCls}>
          Agenda
          <span className="ml-2 normal-case tracking-normal text-foreground">
            {linked ? "Vinculada ✓" : "Não vinculada"}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-5 px-1">
          {linked ? (
            <div>
              <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                {source}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={sync} disabled={busy}>
                  {busy ? "Sincronizando…" : "Sincronizar"}
                </Button>
                {device && deviceCalendarSupported() && (
                  <Button variant="outline" size="sm" onClick={editDevice} disabled={busy}>
                    Escolher agendas
                  </Button>
                )}
                <Button
                  variant={confirmUnlink ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (!confirmUnlink) return setConfirmUnlink(true);
                    clearCalendar();
                    setConfirmUnlink(false);
                    setMessage("");
                  }}
                >
                  {confirmUnlink ? "Toque de novo para desvincular" : "Desvincular"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Button variant="outline" size="sm" onClick={connectDevice} disabled={busy}>
                  Usar a agenda do celular
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Lê as agendas já sincronizadas no Android (Google, Outlook…). Sem login e sem
                  link secreto. Só funciona no app instalado.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Endereço iCal privado (https://…)"
                />
                <Button onClick={onSaveUrl} disabled={!url.trim() || busy}>
                  Vincular
                </Button>
              </div>
              <div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files)}
                />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  Ou enviar um arquivo .ics
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Google Agenda: Configurações → sua agenda → &ldquo;Endereço secreto no formato
                iCal&rdquo;. Quem tiver esse link pode ler sua agenda; ele fica guardado só neste
                aparelho. Um arquivo enviado é uma cópia e não atualiza sozinho.
              </p>
            </div>
          )}

          {calendars && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Quais agendas usar?</p>
              {calendars.length === 0 ? (
                <p className="mt-2 text-sm">Nenhuma agenda encontrada no celular.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {calendars.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={picked.includes(c.id)}
                          onChange={(e) =>
                            setPicked((cur) =>
                              e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id),
                            )
                          }
                        />
                        <span className="min-w-0 break-words">{c.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={useDevice} disabled={busy || picked.length === 0}>
                  Usar selecionadas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCalendars(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <div>
            <p className={labelCls}>Planejamento automático (sem IA)</p>
            <div className="mt-1 divide-y divide-border">
              <Row
                title="Adicionar os eventos de hoje ao Meu dia"
                hint="Verificado ao abrir o app. Cada evento é adicionado uma vez."
                checked={autoplan.addEvents}
                onChange={(v) => setAutoplan({ addEvents: v })}
              />
              {autoplan.addEvents && (
                <Row
                  title="Incluir eventos de dia inteiro"
                  hint="Aniversários, feriados e similares. Desligado mantém só eventos com horário."
                  checked={autoplan.includeAllDay}
                  onChange={(v) => setAutoplan({ includeAllDay: v })}
                />
              )}
              <Row
                title="Planejar tempo de estudo antes de provas"
                hint="Para eventos cujo título tenha uma das palavras abaixo."
                checked={autoplan.examPrep}
                onChange={(v) => setAutoplan({ examPrep: v })}
              />
            </div>

            {autoplan.examPrep && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Palavras de prova (separadas por vírgula)
                  </label>
                  <Input
                    value={autoplan.examKeywords}
                    onChange={(e) => setAutoplan({ examKeywords: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Estudar</span>
                  <Input
                    type="number"
                    min="5"
                    inputMode="numeric"
                    value={String(autoplan.studyMinutes)}
                    onChange={(e) =>
                      setAutoplan({ studyMinutes: num(e.target.value, 5, 1440, autoplan.studyMinutes) })
                    }
                    className="h-8 w-20 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                  />
                  <span className="text-muted-foreground">min,</span>
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    inputMode="numeric"
                    value={String(autoplan.daysBefore)}
                    onChange={(e) =>
                      setAutoplan({ daysBefore: num(e.target.value, 1, 14, autoplan.daysBefore) })
                    }
                    className="h-8 w-14 px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                  />
                  <span className="text-muted-foreground">
                    {autoplan.daysBefore === 1 ? "dia antes" : "dias antes"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
