import { ymd } from "@/lib/stats";

/**
 * Minimal iCalendar (.ics) reader: single events plus simple recurrences
 * (DAILY / WEEKLY with BYDAY / MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL, EXDATE).
 * Times with a TZID or no zone are read as the device's local time.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  /** Local date, YYYY-MM-DD */
  date: string;
}

const URL_KEY = "doto_calendar_url";
const FILE_KEY = "doto_calendar_file";
const FILE_NAME_KEY = "doto_calendar_file_name";
const CACHE_KEY = "doto_calendar_cache";
const CACHE_MS = 3 * 60 * 60 * 1000;
export const CALENDAR_EVENT = "doto-calendar-updated";

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function put(key: string, value: string): boolean {
  try {
    store()?.setItem(key, value);
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

const notify = () => {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CALENDAR_EVENT));
  } catch {
    /* ignore */
  }
};

export const getCalendarUrl = () => store()?.getItem(URL_KEY) ?? "";
export const getCalendarFileName = () => store()?.getItem(FILE_NAME_KEY) ?? "";
export const hasCalendar = () => Boolean(getCalendarUrl() || store()?.getItem(FILE_KEY));

export function saveCalendarUrl(url: string) {
  store()?.removeItem(FILE_KEY);
  store()?.removeItem(FILE_NAME_KEY);
  store()?.removeItem(CACHE_KEY);
  put(URL_KEY, url.trim());
  notify();
}

/** Returns false if the file is not a calendar or does not fit in storage. */
export function saveCalendarFile(name: string, text: string): boolean {
  if (!text.includes("BEGIN:VCALENDAR")) return false;
  store()?.removeItem(URL_KEY);
  store()?.removeItem(CACHE_KEY);
  if (!put(FILE_KEY, text)) return false;
  put(FILE_NAME_KEY, name);
  notify();
  return true;
}

export function clearCalendar() {
  for (const k of [URL_KEY, FILE_KEY, FILE_NAME_KEY, CACHE_KEY]) store()?.removeItem(k);
  notify();
}

/** Last calendar text we have, without any network. */
export function cachedCalendarText(): string {
  const file = store()?.getItem(FILE_KEY);
  if (file) return file;
  try {
    const raw = store()?.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as { text?: string }).text ?? "" : "";
  } catch {
    return "";
  }
}

type NativeHttp = {
  get: (o: { url: string; responseType?: string }) => Promise<{ status: number; data: unknown }>;
};

/** Native HTTP when running inside the Android app (no CORS), plain fetch otherwise. */
async function httpGet(url: string, signal?: AbortSignal): Promise<string> {
  const native = (globalThis as { Capacitor?: { Plugins?: { CapacitorHttp?: NativeHttp } } })
    .Capacitor?.Plugins?.CapacitorHttp;
  if (native?.get) {
    const res = await native.get({ url, responseType: "text" });
    if (res.status >= 400) throw new Error(`Calendar request failed (${res.status}).`);
    return typeof res.data === "string" ? res.data : String(res.data ?? "");
  }
  try {
    const res = await fetch(url, signal ? { signal } : {});
    if (!res.ok) throw new Error(`Calendar request failed (${res.status}).`);
    return await res.text();
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        "Couldn't load the calendar link (blocked by the browser). Upload the .ics file instead.",
      );
    }
    throw e;
  }
}

/**
 * The calendar text from the linked file or link. A link is only downloaded
 * again after 3 hours (or when forced); if the download fails the last copy is used.
 */
export async function loadCalendarText(force = false, signal?: AbortSignal): Promise<string> {
  const file = store()?.getItem(FILE_KEY);
  if (file) return file;
  const url = getCalendarUrl();
  if (!url) throw new Error("No calendar linked.");

  let stale = "";
  try {
    const raw = store()?.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at?: number; text?: string };
      stale = c.text ?? "";
      if (!force && stale && typeof c.at === "number" && Date.now() - c.at < CACHE_MS) return stale;
    }
  } catch {
    /* ignore a broken cache */
  }

  try {
    const clean = url.replace(/^webcal:/i, "https:");
    if (!/^https:\/\//i.test(clean)) {
      throw new Error("The calendar address must start with https:// or webcal://");
    }
    const text = await httpGet(clean, signal);
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That address did not return a calendar.");
    put(CACHE_KEY, JSON.stringify({ at: Date.now(), text }));
    notify();
    return text;
  } catch (e) {
    if (stale) return stale;
    throw e;
  }
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 1) return null;
  const [name = "", ...paramParts] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (s: string) =>
  s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** 20261026, 20261026T150000, 20261026T180000Z -> Date (+ whether it had a time). */
function parseDate(value: string, allDayHint: boolean): { date: Date; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se, z] = m;
  const allDay = allDayHint || h === undefined;
  if (allDay) return { date: new Date(Number(y), Number(mo) - 1, Number(d)), allDay: true };
  if (z) {
    return {
      date: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se ?? 0))),
      allDay: false,
    };
  }
  return {
    date: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se ?? 0)),
    allDay: false,
  };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface Rule {
  freq: string;
  interval: number;
  count: number | null;
  until: Date | null;
  byDay: number[];
}

function parseRule(value: string): Rule {
  const parts: Record<string, string> = {};
  for (const kv of value.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  }
  const until = parts["UNTIL"] ? parseDate(parts["UNTIL"], false)?.date ?? null : null;
  return {
    freq: parts["FREQ"] ?? "",
    interval: Math.max(1, Number(parts["INTERVAL"] ?? 1) || 1),
    count: parts["COUNT"] ? Number(parts["COUNT"]) || null : null,
    until,
    byDay: (parts["BYDAY"] ?? "")
      .split(",")
      .map((c) => DAY_CODES.indexOf(c.replace(/^[+-]?\d+/, "")))
      .filter((n) => n >= 0),
  };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 864e5);

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Does `day` fall on an occurrence of `rule` that starts on `start`'s date? */
function matches(rule: Rule, start: Date, day: Date): boolean {
  const n = dayDiff(start, day);
  if (n < 0) return false;
  switch (rule.freq) {
    case "DAILY":
      return n % rule.interval === 0;
    case "WEEKLY": {
      const days = rule.byDay.length > 0 ? rule.byDay : [start.getDay()];
      const weeks = Math.round(dayDiff(mondayOf(start), mondayOf(day)) / 7);
      return weeks % rule.interval === 0 && days.includes(day.getDay());
    }
    case "MONTHLY": {
      const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
      return months % rule.interval === 0 && day.getDate() === start.getDate();
    }
    case "YEARLY":
      return (
        (day.getFullYear() - start.getFullYear()) % rule.interval === 0 &&
        day.getMonth() === start.getMonth() &&
        day.getDate() === start.getDate()
      );
    default:
      return false;
  }
}

interface RawEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  rule: Rule | null;
  exdates: Set<string>;
  recurrenceId: string | null;
  cancelled: boolean;
}

function readEvents(text: string): RawEvent[] {
  const lines = unfold(text);
  const events: RawEvent[] = [];
  let cur: Prop[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = [];
      continue;
    }
    if (line === "END:VEVENT" && cur) {
      const get = (n: string) => cur?.find((p) => p.name === n);
      const dtstart = get("DTSTART");
      const parsed = dtstart
        ? parseDate(dtstart.value, dtstart.params["VALUE"] === "DATE")
        : null;
      if (dtstart && parsed) {
        const dtend = get("DTEND");
        const end = dtend ? parseDate(dtend.value, dtend.params["VALUE"] === "DATE") : null;
        const rrule = get("RRULE");
        const exdates = new Set<string>();
        for (const p of cur.filter((x) => x.name === "EXDATE")) {
          for (const v of p.value.split(",")) {
            const d = parseDate(v, p.params["VALUE"] === "DATE");
            if (d) exdates.add(ymd(d.date));
          }
        }
        const rid = get("RECURRENCE-ID");
        const ridDate = rid ? parseDate(rid.value, rid.params["VALUE"] === "DATE") : null;
        events.push({
          uid: get("UID")?.value ?? `${events.length}`,
          title: unescapeText(get("SUMMARY")?.value ?? "(no title)") || "(no title)",
          start: parsed.date,
          end: end?.date ?? null,
          allDay: parsed.allDay,
          rule: rrule ? parseRule(rrule.value) : null,
          exdates,
          recurrenceId: ridDate ? ymd(ridDate.date) : null,
          cancelled: get("STATUS")?.value.toUpperCase() === "CANCELLED",
        });
      }
      cur = null;
      continue;
    }
    if (cur) {
      const p = parseProp(line);
      if (p) cur.push(p);
    }
  }
  return events;
}

/** Events that fall between two local dates (inclusive), sorted by start. */
export function parseIcs(text: string, fromDate: string, toDate: string): CalendarEvent[] {
  const raw = readEvents(text);
  const from = startOfDay(new Date(`${fromDate}T12:00:00`));
  const to = startOfDay(new Date(`${toDate}T12:00:00`));

  // Moved single occurrences replace the generated one on their original date.
  const replaced = new Set(
    raw.filter((e) => e.recurrenceId).map((e) => `${e.uid}|${e.recurrenceId}`),
  );

  const out: CalendarEvent[] = [];
  const push = (e: RawEvent, start: Date) => {
    const duration = e.end ? e.end.getTime() - e.start.getTime() : null;
    out.push({
      id: `${e.uid}|${ymd(start)}`,
      title: e.title,
      start,
      end: duration === null ? null : new Date(start.getTime() + duration),
      allDay: e.allDay,
      date: ymd(start),
    });
  };

  for (const e of raw) {
    if (e.cancelled) continue;
    if (!e.rule || e.recurrenceId) {
      const d = startOfDay(e.start);
      if (d >= from && d <= to) push(e, e.start);
      continue;
    }
    let count = 0;
    const last = e.rule.until && e.rule.until < to ? e.rule.until : to;
    const startDay = startOfDay(e.start);
    // Without COUNT the pattern can be checked directly, so old events skip ahead.
    const day = e.rule.count === null && startDay < from ? new Date(from) : new Date(startDay);
    for (let i = 0; i < 4000 && day <= last; i++, day.setDate(day.getDate() + 1)) {
      if (!matches(e.rule, e.start, day)) continue;
      count++;
      if (e.rule.count !== null && count > e.rule.count) break;
      const key = ymd(day);
      if (day < from || e.exdates.has(key) || replaced.has(`${e.uid}|${key}`)) continue;
      const start = new Date(day);
      start.setHours(e.start.getHours(), e.start.getMinutes(), 0, 0);
      push(e, e.allDay ? new Date(day) : start);
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export const timeLabel = (e: CalendarEvent) =>
  e.allDay
    ? "all day"
    : `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")}`;
