const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Interpret datetime-local input as Manila wall time, independent of host TZ. */
export function parseManilaDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error("Enter a valid Manila check-in time.");
  const normalized = `${match[1]}T${match[2]}:${match[3] ?? "00"}`;
  const date = new Date(`${normalized}+08:00`);
  // Date parsing can normalize impossible calendar days/hours; reject those.
  if (!Number.isFinite(date.getTime()) || toManilaDateTimeValue(date.toISOString()) !== normalized) {
    throw new Error("Enter a valid Manila check-in time.");
  }
  return date.toISOString();
}

export function toManilaDateTimeValue(value: string): string {
  const instant = new Date(value).getTime();
  if (!Number.isFinite(instant)) return "";
  return new Date(instant + MANILA_OFFSET_MS).toISOString().slice(0, 19);
}

export function formatManilaTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  });
}

/** DATE + TIME is Manila wall time; use only when an instant is needed to sort. */
export function serviceTimestamp(serviceDate: string, startTime: string | null): number {
  const instant = new Date(`${serviceDate}T${startTime || "23:59"}+08:00`).getTime();
  return Number.isFinite(instant) ? instant : 0;
}
