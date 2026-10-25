import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileText, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import {
  buildPayload,
  clearApiKey,
  fileToAttachment,
  getApiKey,
  isProposalEmpty,
  partImages,
  partText,
  saveApiKey,
  sendChat,
  type Attachment,
  type ChatTurn,
  type Proposal,
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
                  alt="attachment"
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
      <p className={label}>Gemini wants to change</p>

      {proposal.myDay.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Add to My Day</p>
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
          <p className="mb-1 text-xs text-muted-foreground">New tasks</p>
          <ul className="divide-y divide-border">
            {proposal.newTasks.map((t, i) => (
              <li key={i} className="py-1.5 text-sm">
                {t.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {t.recurrence} · {t.baseType}
                  {t.expiresAt ? ` · due ${t.expiresAt}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.complete.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">Mark as completed</p>
          <ul className="divide-y divide-border">
            {proposal.complete.map((t) => (
              <li key={t.id} className="py-1.5 text-sm">
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onApply} className="flex-1">
          <Check className="size-4" /> Apply
        </Button>
        <Button variant="outline" onClick={onDiscard}>
          <X className="size-4" /> Discard
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getApiKey().then((k) => {
      setApiKey(k);
      setHasKey(Boolean(k));
    });
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, busy, proposal]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  const onSaveKey = async () => {
    if (!apiKey.trim()) return;
    await saveApiKey(apiKey);
    setHasKey(true);
    flash("API key saved on this device.");
  };

  const onClearKey = async () => {
    await clearApiKey();
    setApiKey("");
    setHasKey(false);
  };

  const onCopy = async () => {
    const ok = await copyText(JSON.stringify(buildPayload(globalTasks, dailyTasks), null, 2));
    flash(ok ? "Tasks copied as JSON." : "Couldn't copy to the clipboard.");
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const room = MAX_ATTACHMENTS - attachments.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) flash(`Up to ${MAX_ATTACHMENTS} files per message.`);
    try {
      const added = await Promise.all(chosen.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that file.");
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSend = async () => {
    if (busy || !apiKey.trim() || (!draft.trim() && attachments.length === 0)) return;
    setError("");
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
        signal: controller.signal,
      });
      setHistory(result.history);
      setProposal(isProposalEmpty(result.proposal) ? null : result.proposal);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Give the message back so nothing is lost.
      setDraft(text);
      setAttachments(sent);
    } finally {
      setBusy(false);
    }
  };

  const onApply = () => {
    if (!proposal) return;
    const s = useStore.getState();
    proposal.complete.forEach((t) => s.completeGlobalTask(t.id));
    proposal.newTasks.forEach((t) =>
      s.addGlobalTask({
        title: t.title,
        recurrence: t.recurrence,
        baseType: t.baseType,
        parentId: null,
        ...(t.expiresAt ? { expiresAt: t.expiresAt } : {}),
      }),
    );
    proposal.myDay.forEach((m) => s.addToMyDay(m.task.id, m.task.baseType, m.targetValue));
    setProposal(null);
    flash("Applied. Check All Tasks and My Day.");
  };

  const onNewChat = () => {
    abort.current?.abort();
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
        <p className={label}>Gemini API key</p>
        <div className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
          />
          <Button variant="outline" onClick={onSaveKey} disabled={!apiKey.trim()}>
            Save
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Stored only on this device. Messages, photos and your tasks go to Google.
          {hasKey && (
            <button onClick={onClearKey} className="ml-2 underline underline-offset-2">
              Remove key
            </button>
          )}
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Chat</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onCopy} aria-label="Copy tasks as JSON">
              <Copy className="size-4" />
            </Button>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onNewChat} aria-label="New chat">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {history.length === 0 && !busy && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ask anything. Send a photo of a list or a PDF. Say &ldquo;plan my day&rdquo; and
              Gemini suggests changes you can approve.
            </p>
          )}
          {history.map((turn, i) => (
            <Bubble key={i} turn={turn} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
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
                  aria-label="Remove attachment"
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
            aria-label="Attach image or PDF"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Gemini"
            rows={1}
            className="min-h-10 flex-1 resize-none"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={busy || !apiKey.trim() || (!draft.trim() && attachments.length === 0)}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
