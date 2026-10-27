import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarSettings } from "@/components/CalendarSettings";
import { NotificationSettings } from "@/components/NotificationSettings";
import { MemoryPanel } from "@/components/MemoryPanel";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { goalLabel } from "@/lib/stats";
import {
  buildPayload,
  clearApiKey,
  fileToAttachment,
  getApiKey,
  isProposalEmpty,
  MODEL_ORDER,
  getSpeed,
  saveSpeed,
  partImages,
  partText,
  saveApiKey,
  sendChat,
  type Attachment,
  type ChatTurn,
  type Proposal,
  type Speed,
} from "@/lib/gemini";

const label = "mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground";
const MAX_ATTACHMENTS = 4;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const text = partText(turn.parts);
  const media = partImages(turn.parts);
  // Tool results and tool-only turns have nothing to show.
  if (!text && media.length === 0) return null;
  const mine = turn.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {media.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {media.map((m, i) =>
              m.mimeType.startsWith("image/") ? (
                <img
                  key={i}
                  src={`data:${m.mimeType};base64,${m.data}`}
                  alt="anexo"
                  className="max-h-40 rounded-lg"
                />
              ) : (
                <span key={i} className="flex items-center gap-1 text-xs opacity-80">
                  <FileText className="size-4" /> PDF
                </span>
              ),
            )}
          </div>
        )}
        {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onApply,
  onDiscard,
}: {
  proposal: Proposal;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className={label}>O Gemini quer alterar</p>

      {proposal.myDay.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Adicionar ao Meu dia</p>
          <ul className="divide-y divide-border">
            {proposal.myDay.map((m) => (
              <li key={m.task.id} className="py-1.5 text-sm">
                {m.task.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.task.baseType === "Time"
                    ? `${m.targetValue} min`
                    : m.task.baseType === "Count"
                      ? `×${m.targetValue}`
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.newTasks.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Novas tarefas</p>
          <ul className="divide-y divide-border">
            {proposal.newTasks.map((t, i) => (
              <li key={i} className="py-1.5 text-sm">
                {t.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {t.recurrence} · {t.baseType}
                  {t.expiresAt ? ` · vence ${t.expiresAt}` : ""}
                  {t.plan ? " · + My Day" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.complete.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Marcar como concluídas</p>
          <ul className="divide-y divide-border">
            {proposal.complete.map((t) => (
              <li key={t.id} className="py-1.5 text-sm">
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.removeFromDay.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Tirar do Meu dia</p>
          <ul className="divide-y divide-border">
            {proposal.removeFromDay.map((x) => (
              <li key={x.task.id} className="py-1.5 text-sm">
                {x.task.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(proposal.memoryAdd.length > 0 || proposal.memoryRemove.length > 0) && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Memória</p>
          <ul className="divide-y divide-border">
            {proposal.memoryAdd.map((n) => (
              <li key={`a-${n}`} className="py-1.5 text-sm">
                <span className="mr-2 text-xs text-muted-foreground">Lembrar</span>
                {n}
              </li>
            ))}
            {proposal.memoryRemove.map((n) => (
              <li key={`r-${n}`} className="py-1.5 text-sm">
                <span className="mr-2 text-xs text-destructive">Esquecer</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.setGoals.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Metas semanais</p>
          <ul className="divide-y divide-border">
            {proposal.setGoals.map((x) => (
              <li key={x.task.id} className="py-1.5 text-sm">
                {x.task.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {x.goal ? goalLabel(x.goal, x.task.baseType) : "remover meta"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.deleteTasks.length > 0 && (
        <div className="mb-3 rounded-lg border border-destructive/50 p-3">
          <p className="mb-1 text-xs font-medium text-destructive">
            Excluir definitivamente (sem desfazer)
          </p>
          <ul className="divide-y divide-border">
            {proposal.deleteTasks.map((x) => (
              <li key={x.task.id} className="py-1.5 text-sm">
                {x.task.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {x.subtaskCount > 0
                    ? `também exclui ${x.subtaskCount} subtarefa${x.subtaskCount > 1 ? "s" : ""} e o histórico`
                    : "e o histórico dela"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onApply}
          variant={proposal.deleteTasks.length > 0 ? "destructive" : "default"}
          className="flex-1"
        >
          <Check className="size-4" />{" "}
          {proposal.deleteTasks.length > 0 ? "Aplicar e excluir" : "Aplicar"}
        </Button>
        <Button variant="outline" onClick={onDiscard}>
          <X className="size-4" /> Descartar
        </Button>
      </div>
    </div>
  );
}

export function GeminiSync() {
  const globalTasks = useStore((s) => s.globalTasks);
  const dailyTasks = useStore((s) => s.dailyTasks);

  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [keyOpen, setKeyOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState<Speed>("smart");
  const [status, setStatus] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [meta, setMeta] = useState<{ model: string; ms: number; calls: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSpeed(getSpeed());
    getApiKey().then((k) => {
      setApiKey(k);
      setHasKey(Boolean(k));
      setKeyOpen(!k);
    });
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setElapsed(0);
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(i);
  }, [busy]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, busy, proposal]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 5000);
  };

  const onSaveKey = async () => {
    if (!apiKey.trim()) return;
    await saveApiKey(apiKey);
    setHasKey(true);
    setEditingKey(false);
    setKeyOpen(false);
    flash("Chave da API salva neste aparelho.");
  };

  const onClearKey = async () => {
    await clearApiKey();
    setApiKey("");
    setHasKey(false);
    setEditingKey(false);
    setConfirmRemove(false);
    setKeyOpen(true);
  };

  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-3)}` : "••••••••";

  const onCopy = async () => {
    const ok = await copyText(JSON.stringify(buildPayload(globalTasks, dailyTasks, useStore.getState().memory), null, 2));
    flash(ok ? "Tarefas copiadas como JSON." : "Não consegui copiar.");
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const room = MAX_ATTACHMENTS - attachments.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) flash(`Até ${MAX_ATTACHMENTS} arquivos por mensagem.`);
    try {
      const added = await Promise.all(chosen.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui adicionar esse arquivo.");
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSend = async () => {
    if (busy || !apiKey.trim() || (!draft.trim() && attachments.length === 0)) return;
    setError("");
    setStatus("");
    setMeta(null);
    setBusy(true);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    const text = draft;
    const sent = attachments;
    setDraft("");
    setAttachments([]);
    try {
      const { globalTasks: g, dailyTasks: d } = useStore.getState();
      const result = await sendChat({
        apiKey: apiKey.trim(),
        history,
        text,
        attachments: sent,
        globalTasks: g,
        dailyTasks: d,
        memory: useStore.getState().memory,
        speed,
        signal: controller.signal,
        onStatus: setStatus,
      });
      setHistory(result.history);
      setMeta({ model: result.model, ms: result.ms, calls: result.calls });
      const first = MODEL_ORDER[speed][0];
      if (first && result.model !== first) flash(`${first} was busy, answered by ${result.model}.`);
      setProposal(isProposalEmpty(result.proposal) ? null : result.proposal);
    } catch (e) {
      // Stopped by the user: give the message back, say nothing. New chat clears abort.current.
      if (controller.signal.aborted) {
        if (abort.current === controller) {
          setDraft(text);
          setAttachments(sent);
        }
        return;
      }
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      // Give the message back so nothing is lost.
      setDraft(text);
      setAttachments(sent);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const onApply = () => {
    if (!proposal) return;
    const s = useStore.getState();
    proposal.complete.forEach((t) => s.completeGlobalTask(t.id));
    proposal.newTasks.forEach((t) => {
      const id = s.addGlobalTask({
        title: t.title,
        recurrence: t.recurrence,
        baseType: t.baseType,
        parentId: null,
        ...(t.expiresAt ? { expiresAt: t.expiresAt } : {}),
      });
      if (t.plan) s.addToMyDay(id, t.baseType, t.plan);
    });
    proposal.memoryAdd.forEach((n) => s.addMemory(n));
    proposal.memoryRemove.forEach((n) => s.removeMemory(n));
    proposal.myDay.forEach((m) => s.addToMyDay(m.task.id, m.task.baseType, m.targetValue));
    proposal.setGoals.forEach((x) => s.updateGlobalTask(x.task.id, { weeklyGoal: x.goal }));
    proposal.removeFromDay.forEach((x) => s.removeDailyTask(x.dailyId));
    proposal.deleteTasks.forEach((x) => s.removeGlobalTask(x.task.id));
    setProposal(null);
    flash("Aplicado. Veja Tarefas e Meu dia.");
  };

  const onStop = () => abort.current?.abort();

  const onNewChat = () => {
    abort.current?.abort();
    abort.current = null;
    setHistory([]);
    setProposal(null);
    setAttachments([]);
    setDraft("");
    setError("");
    setBusy(false);
  };

  return (
    <div className="space-y-8">
      <section>
        <button
          type="button"
          onClick={() => {
            setKeyOpen((o) => !o);
            setConfirmRemove(false);
          }}
          aria-expanded={keyOpen}
          className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left"
        >
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Chave da API do Gemini
            <span className="ml-2 normal-case tracking-normal text-foreground">
              {hasKey ? "Salva ✓" : "Não definida"}
            </span>
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${keyOpen ? "rotate-180" : ""}`}
          />
        </button>

        {keyOpen && (
          <div className="mt-3 px-1">
            {hasKey && !editingKey ? (
              <>
                <p className="rounded-md border border-border px-3 py-2 font-mono text-sm text-muted-foreground">
                  {maskedKey}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setApiKey("");
                      setEditingKey(true);
                      setConfirmRemove(false);
                    }}
                  >
                    Alterar
                  </Button>
                  <Button
                    variant={confirmRemove ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => (confirmRemove ? onClearKey() : setConfirmRemove(true))}
                  >
                    {confirmRemove ? "Toque de novo para remover" : "Remover"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza…"
                />
                <Button onClick={onSaveKey} disabled={!apiKey.trim()}>
                  Salvar
                </Button>
                {editingKey && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      getApiKey().then(setApiKey);
                      setEditingKey(false);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Guardada só neste aparelho. Mensagens, fotos e suas tarefas são enviadas ao Google.
            </p>
          </div>
        )}
      </section>

      <CalendarSettings />
      <NotificationSettings />
      <MemoryPanel />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Conversa</p>
            <div className="flex overflow-hidden rounded-full border border-border text-[11px]">
              {(["smart", "fast"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setSpeed(v);
                    saveSpeed(v);
                  }}
                  title={
                    v === "fast"
                      ? "Modelo mais leve: mais rápido, menos cuidadoso com fotos e planejamento"
                      : "Melhores respostas, pode ser mais lento"
                  }
                  className={`px-2.5 py-1 ${
                    speed === v ? "bg-foreground text-background" : "text-muted-foreground"
                  }`}
                >
                  {v === "fast" ? "Rápido" : "Inteligente"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onCopy} aria-label="Copiar tarefas como JSON">
              <Copy className="size-4" />
            </Button>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onNewChat} aria-label="Nova conversa">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {history.length === 0 && !busy && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pergunte qualquer coisa. Envie a foto de uma lista ou um PDF. Diga &ldquo;planeje meu
              dia&rdquo; e o Gemini sugere mudanças que você pode aprovar.
            </p>
          )}
          {history.map((turn, i) => (
            <Bubble key={i} turn={turn} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Pensando… {elapsed}s
              {status ? ` · ${status}` : ""}
            </div>
          )}
          {meta && !busy && (
            <p className="text-[11px] text-muted-foreground">
              {meta.model} · {(meta.ms / 1000).toFixed(1)}s
              {meta.calls > 1 ? ` · ${meta.calls} etapas` : ""}
            </p>
          )}
          {proposal && !busy && (
            <ProposalCard
              proposal={proposal}
              onApply={onApply}
              onDiscard={() => setProposal(null)}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          <div ref={bottom} />
        </div>

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {a.mimeType.startsWith("image/") ? (
                  <img
                    src={`data:${a.mimeType};base64,${a.data}`}
                    alt={a.name}
                    className="size-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-16 flex-col items-center justify-center rounded-lg bg-muted text-[10px]">
                    <FileText className="size-5" />
                    PDF
                  </div>
                )}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                  aria-label="Remover anexo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInput.current?.click()}
            disabled={busy || attachments.length >= MAX_ATTACHMENTS}
            aria-label="Anexar imagem ou PDF"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem para o Gemini"
            rows={1}
            className="min-h-10 flex-1 resize-none"
          />
          {busy ? (
            <Button size="icon" variant="outline" onClick={onStop} aria-label="Parar">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={onSend}
              disabled={!apiKey.trim() || (!draft.trim() && attachments.length === 0)}
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
