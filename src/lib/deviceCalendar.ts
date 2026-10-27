import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Reads the calendars already synced on the phone (Google, Outlook, ...) through
 * the Android calendar. No login and no API key: the phone's own sync does the work.
 *
 * Needs the native plugin: npm install @ebarooni/capacitor-calendar (then build the app).
 * It is called through registerPlugin, so the app still builds without the package;
 * without it, the calls fail with a clear message instead.
 */

export interface RawDeviceEvent {
  id: string;
  title?: string | null;
  startDate: number;
  endDate?: number | null;
  isAllDay?: boolean | null;
  calendarId?: string | null;
}

export interface DeviceCalendarInfo {
  id: string;
  title: string;
}

interface CalendarPlugin {
  checkPermission(o: { scope: string }): Promise<{ result: string }>;
  requestReadOnlyCalendarAccess(): Promise<{ result: string }>;
  listCalendars(): Promise<{ result: { id: string; title?: string | null }[] }>;
  listEventsInRange(o: { from: number; to: number }): Promise<{ result: RawDeviceEvent[] }>;
}

const Calendar = registerPlugin<CalendarPlugin>("CapacitorCalendar");

export const deviceCalendarSupported = () => Capacitor.isNativePlatform();

function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not implemented|not available|unimplemented/i.test(msg)) {
    return new Error(
      "O plugin da agenda não está instalado neste app (@ebarooni/capacitor-calendar).",
    );
  }
  if (/permission|EB-CLDR-0020|denied/i.test(msg)) {
    return new Error("Sem permissão para ler a agenda. Libere em Configurações do Android.");
  }
  return e instanceof Error ? e : new Error(msg);
}

export async function requestDeviceAccess(): Promise<boolean> {
  if (!deviceCalendarSupported()) {
    throw new Error("A agenda do celular só funciona no app instalado.");
  }
  try {
    const res = await Calendar.requestReadOnlyCalendarAccess();
    return res.result === "granted";
  } catch (e) {
    throw friendly(e);
  }
}

export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  try {
    const res = await Calendar.listCalendars();
    return (res.result ?? []).map((c) => ({ id: c.id, title: c.title?.trim() || "Agenda" }));
  } catch (e) {
    throw friendly(e);
  }
}

/** Events between two local dates (YYYY-MM-DD), inclusive. */
export async function queryDeviceEvents(from: string, to: string): Promise<RawDeviceEvent[]> {
  if (!deviceCalendarSupported()) {
    throw new Error("A agenda do celular só funciona no app instalado.");
  }
  try {
    const res = await Calendar.listEventsInRange({
      from: new Date(`${from}T00:00:00`).getTime(),
      to: new Date(`${to}T23:59:59`).getTime(),
    });
    return res.result ?? [];
  } catch (e) {
    throw friendly(e);
  }
}
