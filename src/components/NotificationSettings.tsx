import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  notificationsSupported,
  requestNotifyPermission,
  sendTestNotification,
  syncNotifications,
} from "@/lib/notify";
import { useStore } from "@/lib/store";

const labelCls = "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

/** Daily phone reminders: a morning summary and an evening heads-up. No AI used. */
export function NotificationSettings() {
  const notify = useStore((s) => s.notify);
  const setNotify = useStore((s) => s.setNotify);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);

  useEffect(() => setSupported(notificationsSupported()), []);

  const toggle = async (on: boolean) => {
    setMessage("");
    if (on) {
      if (!(await requestNotifyPermission())) {
        setMessage("Permissão negada. Libere as notificações nas configurações do Android.");
        return;
      }
    }
    setNotify({ enabled: on });
    // The store change schedules the reminders by itself a few seconds later; do it now too.
    setTimeout(() => void syncNotifications(), 100);
  };

  const test = async () => {
    setMessage((await sendTestNotification()) ? "Chega em alguns segundos." : "Não consegui enviar. Verifique a permissão de notificações.");
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
          Lembretes
          <span className="ml-2 normal-case tracking-normal text-foreground">
            {notify.enabled ? "Ligados ✓" : "Desligados"}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4 px-1">
          {!supported && (
            <p className="text-xs text-muted-foreground">
              Os lembretes só funcionam no app instalado no celular.
            </p>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm">Notificações diárias</p>
              <p className="text-xs text-muted-foreground">
                Resumo da manhã (agenda, estudos, prazos) e aviso da noite (provas, prazos de
                amanhã, metas). Sem IA.
              </p>
            </div>
            <Switch
              checked={notify.enabled}
              onCheckedChange={toggle}
              disabled={!supported}
              aria-label="Notificações diárias"
            />
          </div>

          {notify.enabled && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Manhã</span>
                  <Input
                    type="time"
                    value={notify.morning}
                    onChange={(e) => e.target.value && setNotify({ morning: e.target.value })}
                    className="h-8 w-28 px-2"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Noite</span>
                  <Input
                    type="time"
                    value={notify.evening}
                    onChange={(e) => e.target.value && setNotify({ evening: e.target.value })}
                    className="h-8 w-28 px-2"
                  />
                </label>
              </div>
              <Button variant="outline" size="sm" onClick={test}>
                Enviar teste
              </Button>
              <p className="text-xs text-muted-foreground">
                Os lembretes dos próximos 7 dias são agendados no celular sempre que você abre o
                app ou muda algo. Se ficar vários dias sem abrir, eles acabam.
              </p>
            </>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      )}
    </section>
  );
}
