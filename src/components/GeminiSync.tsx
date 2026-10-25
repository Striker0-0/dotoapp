import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import {
  askGemini,
  buildPayload,
  clearApiKey,
  getApiKey,
  resolvePlan,
  saveApiKey,
  type Proposal,
} from "@/lib/gemini";

const label = "mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

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

export function GeminiSync() {
  const globalTasks = useStore((s) => s.globalTasks);
  const dailyTasks = useStore((s) => s.dailyTasks);

  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [request, setRequest] = useState("Plan my day around what is due soonest.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getApiKey().then((k) => {
      setApiKey(k);
      setHasKey(Boolean(k));
    });
    return () => abort.current?.abort();
  }, []);

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

  const onAsk = async () => {
    setError("");
    setProposal(null);
    setBusy(true);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { globalTasks: g, dailyTasks: d } = useStore.getState();
      const plan = await askGemini(
        apiKey.trim(),
        request.trim() || "Plan my day.",
        buildPayload(g, d),
        controller.signal,
      );
      setProposal(resolvePlan(plan, g, d));
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
    flash("Applied. Check My Day.");
  };

  const empty =
    proposal &&
    proposal.myDay.length === 0 &&
    proposal.newTasks.length === 0 &&
    proposal.complete.length === 0;

  return (
    <div className="space-y-10">
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
          Stored only on this device. Your tasks are sent to Google when you ask Gemini.
          {hasKey && (
            <button onClick={onClearKey} className="ml-2 underline underline-offset-2">
              Remove key
            </button>
          )}
        </p>
      </section>

      <section>
        <p className={label}>Ask Gemini</p>
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g. Plan a light day, add a gym habit"
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={onAsk} disabled={busy || !apiKey.trim()} className="flex-1">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Thinking…" : "Get suggestions"}
          </Button>
          <Button variant="outline" onClick={onCopy} aria-label="Copy tasks as JSON">
            <Copy className="size-4" />
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      </section>

      {proposal && (
        <section>
          <p className={label}>Suggestions</p>
          {proposal.summary && <p className="mb-4 text-sm">{proposal.summary}</p>}
          {empty && (
            <p className="text-sm text-muted-foreground">Nothing to change right now.</p>
          )}

          {proposal.myDay.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs text-muted-foreground">Add to My Day</p>
              <ul className="divide-y divide-border">
                {proposal.myDay.map((m) => (
                  <li key={m.task.id} className="py-2 text-sm">
                    {m.task.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {m.task.baseType === "Time"
                        ? `${m.targetValue} min`
                        : m.task.baseType === "Count"
                          ? `×${m.targetValue}`
                          : ""}
                    </span>
                    {m.reason && (
                      <p className="text-xs text-muted-foreground">{m.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proposal.newTasks.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs text-muted-foreground">New tasks</p>
              <ul className="divide-y divide-border">
                {proposal.newTasks.map((t, i) => (
                  <li key={i} className="py-2 text-sm">
                    {t.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.recurrence} · {t.baseType}
                      {t.expiresAt ? ` · due ${t.expiresAt}` : ""}
                    </span>
                    {t.reason && <p className="text-xs text-muted-foreground">{t.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proposal.complete.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs text-muted-foreground">Mark as completed</p>
              <ul className="divide-y divide-border">
                {proposal.complete.map((t) => (
                  <li key={t.id} className="py-2 text-sm">
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            {!empty && (
              <Button onClick={onApply} className="flex-1">
                <Check className="size-4" /> Apply
              </Button>
            )}
            <Button variant="outline" onClick={() => setProposal(null)}>
              <X className="size-4" /> {empty ? "Close" : "Discard"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
