import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_MEMORY_NOTES, MAX_NOTE_LENGTH, useStore } from "@/lib/store";

/**
 * Notes Gemini keeps between chats. They are sent with every message, so the
 * list is capped small: this is the cheap way to keep context without resending old chats.
 */
export function MemoryPanel() {
  const memory = useStore((s) => s.memory);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    addMemory(draft);
    setDraft("");
  };

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left"
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Memory
          <span className="ml-2 normal-case tracking-normal text-foreground">
            {memory.length === 0 ? "Empty" : `${memory.length} ${memory.length === 1 ? "note" : "notes"}`}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 px-1">
          {memory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing saved. Tell Gemini &ldquo;remember that I study best in the morning&rdquo; and
              approve the note, or add one here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {memory.map((note) => (
                <li key={note} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{note}</span>
                  <button
                    type="button"
                    onClick={() => removeMemory(note)}
                    aria-label="Forget this note"
                    className="mt-0.5 shrink-0 text-muted-foreground/70 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <Input
              value={draft}
              maxLength={MAX_NOTE_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add a note"
            />
            <Button variant="outline" size="icon" onClick={add} disabled={!draft.trim()} aria-label="Add note">
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Sent with every message, so keep it short (up to {MAX_MEMORY_NOTES} notes). Old chats
            are never resent.
          </p>
        </div>
      )}
    </section>
  );
}
