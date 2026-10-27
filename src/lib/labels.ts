import type { Recurrence, TrackingType } from "@/lib/store";

/** The app is used in Brazilian Portuguese. Stored values stay in English; only labels are translated. */
export const LOCALE = "pt-BR";

export const typeLabel: Record<TrackingType, string> = {
  Simple: "Simples",
  Time: "Tempo",
  Count: "Contagem",
};

export const recurrenceLabel: Record<Recurrence, string> = {
  Once: "Única",
  Repetitive: "Recorrente",
};

export const dateText = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(LOCALE, opts);
export const dateTimeText = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleString(LOCALE, opts);

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
