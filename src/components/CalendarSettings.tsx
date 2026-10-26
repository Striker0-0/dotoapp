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
  hasCalendar,
  saveCalendarFile,
  saveCalendarUrl,
} from "@/lib/calendar";
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
    return "linked";
  }
}

/** Link a calendar (private iCal address or an .ics file) and set the auto-plan rules. */
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
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const read = () => {
      setLinked(hasCalendar());
      const file = getCalendarFileName();
      const u = getCalendarUrl();
      setSource(file ? `File: ${file}` : u ? hostOf(u) : "");
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
        `${res.events} ${res.events === 1 ? "event" : "events"} in the next 14 days.` +
          (res.added.length > 0 ? ` Added to My Day: ${res.added.join(", ")}.` : " Nothing new to add."),
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
      setMessage("That isn't a calendar (.ics) file, or it is too big to store.");
    } else {
      await sync();
    }
    if (fileInput.current) fileInput.current.value = "";
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
          Calendar
          <span className="ml-2 normal-case tracking-normal text-foreground">
            {linked ? "Linked ✓" : "Not linked"}
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
                  {busy ? "Syncing…" : "Sync now"}
                </Button>
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
                  {confirmUnlink ? "Tap again to unlink" : "Unlink"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Private iCal address (https://…)"
                />
                <Button onClick={onSaveUrl} disabled={!url.trim() || busy}>
                  Link
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
                  Or upload an .ics file
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Google Calendar: Settings → your calendar → &ldquo;Secret address in iCal
                format&rdquo;. Anyone with that link can read your calendar; it is stored only on
                this device. An uploaded file is a snapshot and will not update.
              </p>
            </div>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <div>
            <p className={labelCls}>Auto-plan (no AI used)</p>
            <div className="mt-1 divide-y divide-border">
              <Row
                title="Add today's events to My Day"
                hint="Checked when you open the app. Each event is added once."
                checked={autoplan.addEvents}
                onChange={(v) => setAutoplan({ addEvents: v })}
              />
              {autoplan.addEvents && (
                <Row
                  title="Include all-day events"
                  hint="Birthdays, holidays and similar. Off keeps only events with a time."
                  checked={autoplan.includeAllDay}
                  onChange={(v) => setAutoplan({ includeAllDay: v })}
                />
              )}
              <Row
                title="Plan study time before exams"
                hint="For events whose title has one of the words below."
                checked={autoplan.examPrep}
                onChange={(v) => setAutoplan({ examPrep: v })}
              />
            </div>

            {autoplan.examPrep && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Exam words (comma separated)
                  </label>
                  <Input
                    value={autoplan.examKeywords}
                    onChange={(e) => setAutoplan({ examKeywords: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Study</span>
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
                    {autoplan.daysBefore === 1 ? "day before" : "days before"}
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
