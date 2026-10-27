import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const labelCls = "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";
const STORAGE_KEY = "tweek-todo-v1";

/** Reads the saved app data exactly as stored (tasks, history, goals, settings, notes). No API key. */
function readBackup(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Save the app data to a file or the clipboard, and restore it later. */
export function BackupPanel() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const download = () => {
    const raw = readBackup();
    if (!raw) return setMessage("Não há dados para salvar.");
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `doto-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMessage("Backup salvo na pasta Downloads.");
  };

  const copy = async () => {
    const raw = readBackup();
    if (!raw) return setMessage("Não há dados para copiar.");
    try {
      await navigator.clipboard.writeText(raw);
      setMessage("Backup copiado. Cole em um lugar seguro (notas, e-mail para você).");
    } catch {
      setMessage("Não consegui copiar. Use “Salvar arquivo”.");
    }
  };

  const [pasted, setPasted] = useState("");

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    check(await file.text());
  };

  const check = (text: string) => {
    try {
      const parsed = JSON.parse(text) as { state?: { globalTasks?: unknown } };
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.state?.globalTasks)) {
        throw new Error("invalid");
      }
      setConfirm(text);
      setMessage("");
    } catch {
      setMessage("Esse arquivo não é um backup do app.");
    }
  };

  const restore = async () => {
    if (!confirm) return;
    try {
      localStorage.setItem(STORAGE_KEY, confirm);
      await useStore.persist.rehydrate();
      setMessage("Backup restaurado.");
    } catch {
      setMessage("Não consegui restaurar o backup.");
    }
    setConfirm(null);
  };

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left"
      >
        <span className={labelCls}>Backup</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3 px-1">
          <p className="text-xs text-muted-foreground">
            Guarda tarefas, histórico, metas e notas (não a chave da API). Faça um backup antes de
            instalar uma versão nova e restaure depois, se algo se perder.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={download}>
              Salvar arquivo
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              Copiar
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              Restaurar de arquivo
            </Button>
          </div>
          <div className="flex gap-2">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Ou cole aqui o backup copiado"
              rows={2}
              className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!pasted.trim()}
              onClick={() => {
                check(pasted.trim());
                setPasted("");
              }}
            >
              Usar
            </Button>
          </div>
          {confirm && (
            <div className="rounded-lg border border-destructive/50 p-3">
              <p className="text-sm">Isto substitui tudo que está no app agora. Continuar?</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" onClick={restore}>
                  Restaurar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      )}
    </section>
  );
}
