/** Pure calculation inputs; serviceDate is the stored local YYYY-MM-DD date. */
export type InactivityMember = {
  id: string;
  branchId: string;
  eligibilityDate: string | null;
};

export type InactivityService = {
  id: string;
  branchId: string;
  serviceDate: string;
  status: string;
};

export type InactivityAttendance = {
  memberId: string;
  serviceId: string;
  status: string;
};

export type MemberInactivitySummary = {
  memberId: string;
  branchId: string;
  eligibilityDate: string | null;
  inactivityThresholdWeeks: number;
  lastAttendedDate: string | null;
  lastAttendedServiceId: string | null;
  recentEligibleWeeks: number;
  recentAttendedWeeks: number;
  /** Percentage from 0 to 100, or null when no eligible weeks exist. */
  recentAttendanceRate: number | null;
} & (
  | {
      calculationStatus: "evaluated";
      consecutiveAbsentWeeks: number;
      isInactive: boolean;
      remainingWeeksBeforeInactive: number;
    }
  | {
      calculationStatus: "eligibility_unknown";
      consecutiveAbsentWeeks: null;
      isInactive: null;
      remainingWeeksBeforeInactive: null;
    }
);

const DAY = 86_400_000;

function dateNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN;
}

function monday(date: number): number {
  return date - ((new Date(date).getUTCDay() + 6) % 7) * DAY;
}

/** Convert instants to Manila dates; never parse service dates as instants. */
export function manilaDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * No writes, caching, role decisions, or percentage-based status decisions.
 * Only full calendar weeks starting on/after eligibility are evaluated.
 * An initial partial week may supply last attendance, but never an absence.
 */
export function calculateWeeklyInactivity(input: {
  members: readonly InactivityMember[];
  services: readonly InactivityService[];
  attendance: readonly InactivityAttendance[];
  thresholds: ReadonlyMap<string, number>;
  today: string;
  recentWeekLimit?: number;
}): MemberInactivitySummary[] {
  const today = dateNumber(input.today);
  if (!Number.isFinite(today)) throw new Error("Invalid reporting date.");
  const currentMonday = monday(today);
  const limit = input.recentWeekLimit ?? 8;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid recent week limit.");

  const services = new Map<string, InactivityService>();
  const branchWeeks = new Map<string, Set<number>>();
  for (const service of input.services) {
    if (service.status !== "completed") continue;
    const date = dateNumber(service.serviceDate);
    if (!Number.isFinite(date)) throw new Error("Invalid completed service date.");
    if (date > today) continue;
    services.set(service.id, service);
    const week = monday(date);
    if (week >= currentMonday) continue;
    const weeks = branchWeeks.get(service.branchId) ?? new Set<number>();
    weeks.add(week);
    branchWeeks.set(service.branchId, weeks);
  }
  const sortedWeeks = new Map(
    Array.from(branchWeeks, ([id, weeks]) => [id, [...weeks].sort((a, b) => b - a)]),
  );
  const members = new Map(input.members.map((member) => [member.id, member]));
  const attendedWeeks = new Map<string, Set<number>>();
  const lastAttendance = new Map<string, InactivityService>();
  for (const attendance of input.attendance) {
    if (attendance.status !== "present" && attendance.status !== "late") continue;
    const member = members.get(attendance.memberId);
    const service = services.get(attendance.serviceId);
    if (!member || !service || service.branchId !== member.branchId) continue;
    const start = member.eligibilityDate ? dateNumber(member.eligibilityDate) : NaN;
    const date = dateNumber(service.serviceDate);
    if (!Number.isFinite(start) || date < start) continue;
    const weeks = attendedWeeks.get(member.id) ?? new Set<number>();
    weeks.add(monday(date));
    attendedWeeks.set(member.id, weeks);
    const previous = lastAttendance.get(member.id);
    if (!previous || service.serviceDate > previous.serviceDate ||
      (service.serviceDate === previous.serviceDate && service.id < previous.id)) {
      lastAttendance.set(member.id, service);
    }
  }

  return input.members.map((member): MemberInactivitySummary => {
    const threshold = input.thresholds.get(member.branchId);
    if (!Number.isInteger(threshold) || threshold! < 1 || threshold! > 52) {
      throw new Error("Missing or invalid branch inactivity threshold.");
    }
    const start = member.eligibilityDate ? dateNumber(member.eligibilityDate) : NaN;
    const last = lastAttendance.get(member.id);
    const base = {
      memberId: member.id, branchId: member.branchId,
      eligibilityDate: Number.isFinite(start) ? member.eligibilityDate : null,
      inactivityThresholdWeeks: threshold!,
      lastAttendedDate: last?.serviceDate ?? null,
      lastAttendedServiceId: last?.id ?? null,
      recentEligibleWeeks: 0, recentAttendedWeeks: 0, recentAttendanceRate: null,
    };
    if (!Number.isFinite(start)) {
      return { ...base, calculationStatus: "eligibility_unknown",
        consecutiveAbsentWeeks: null, isInactive: null, remainingWeeksBeforeInactive: null };
    }
    const weeks = (sortedWeeks.get(member.branchId) ?? []).filter((week) => week >= start);
    const present = attendedWeeks.get(member.id) ?? new Set<number>();
    let streak = 0;
    for (const week of weeks) {
      if (present.has(week)) break;
      streak++;
    }
    const recent = weeks.slice(0, limit);
    const attended = recent.filter((week) => present.has(week)).length;
    return {
      ...base, calculationStatus: "evaluated",
      consecutiveAbsentWeeks: streak,
      isInactive: streak >= threshold!,
      remainingWeeksBeforeInactive: Math.max(0, threshold! - streak),
      recentEligibleWeeks: recent.length, recentAttendedWeeks: attended,
      recentAttendanceRate: recent.length ? attended / recent.length * 100 : null,
    };
  });
}
