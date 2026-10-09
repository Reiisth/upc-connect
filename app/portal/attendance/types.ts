import type {
  ServiceBranch,
  ServiceRecord,
} from "../services/types";

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "excused",
] as const;

export const QR_SCANNABLE_SERVICE_STATUSES = [
  "scheduled",
  "ongoing",
] as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUSES)[number];

export type QrScannableServiceStatus =
  (typeof QR_SCANNABLE_SERVICE_STATUSES)[number];

export type AttendanceMember = {
  id: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  memberStatus: string | null;
  isArchived: boolean;
  churchBranchId: string;
};

export type AttendanceRecord = {
  id: string;
  memberId: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  method: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
};

export type AttendanceMemberRow = {
  member: AttendanceMember;
  attendance: AttendanceRecord | null;
};

export type AttendanceSummary = {
  totalEligible: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
};

export type AttendanceService = ServiceRecord & {
  branch: ServiceBranch | null;
};

export type QrAttendanceResult =
  | {
    outcome: "recorded";
    memberName: string;
    attendanceStatus: AttendanceStatus;
    checkInTime: string;
  }
  | {
    outcome: "duplicate";
    memberName: string;
    attendanceStatus: AttendanceStatus;
    checkInTime: string | null;
    method: string | null;
  };

export function canScanServiceStatus(
  status: string,
): status is QrScannableServiceStatus {
  return QR_SCANNABLE_SERVICE_STATUSES.includes(
    status as QrScannableServiceStatus,
  );
}

export function formatMemberName(member: AttendanceMember) {
  return [
    member.firstName,
    member.middleName,
    member.lastName,
  ]
    .filter(Boolean)
    .join(" ") || "Unnamed member";
}

export function formatAttendanceStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getAttendanceSummary(
  rows: AttendanceMemberRow[],
): AttendanceSummary {
  const summary: AttendanceSummary = {
    totalEligible: rows.length,
    present: 0,
    late: 0,
    excused: 0,
    absent: 0,
  };

  for (const row of rows) {
    if (!row.attendance) {
      summary.absent += 1;
      continue;
    }

    summary[row.attendance.status] += 1;
  }

  return summary;
}
