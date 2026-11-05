import "server-only";

import type { BranchScope } from "@/lib/branch-access";
import { createAdminClient } from "@/lib/supabase/admin";

import { getAccessibleActiveBranches } from "../services/access";
import type { ServiceBranch, ServiceRecord } from "../services/types";
import {
  ATTENDANCE_STATUSES,
  type AttendanceMember,
  type AttendanceMemberRow,
  type AttendanceRecord,
  type AttendanceService,
} from "./types";

type ServiceRow = {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  start_time: string | null;
  status: string;
  church_branch_id: string;
  notes: string | null;
};

type MemberRow = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  member_status: string | null;
  is_archived: boolean;
  church_branch_id: string;
  church_branches?: { name: string } | null;
};

type AttendanceRow = {
  id: string;
  member_id: string;
  attendance_status: string;
  check_in_time: string | null;
  method: string | null;
  recorded_by: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

function mapService(
  row: ServiceRow,
  branch: ServiceBranch | null,
): AttendanceService {
  return {
    id: row.id,
    name: row.name,
    serviceType: row.service_type as ServiceRecord["serviceType"],
    serviceDate: row.service_date,
    startTime: row.start_time,
    status: row.status as ServiceRecord["status"],
    churchBranchId: row.church_branch_id,
    notes: row.notes,
    branch,
  };
}

export async function loadAccessibleService(
  access: BranchScope,
  admin: ReturnType<typeof createAdminClient>,
  serviceId: string,
) {
  const branches = await getAccessibleActiveBranches(access, admin);

  if (!serviceId || branches.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("services")
    .select(
      "id, name, service_type, service_date, start_time, status, church_branch_id, notes",
    )
    .eq("id", serviceId)
    .in(
      "church_branch_id",
      branches.map((branch) => branch.id),
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const branch = branches.find(
    (item) => item.id === data.church_branch_id,
  );

  return mapService(data as ServiceRow, branch ?? null);
}

export async function loadAttendanceRows(
  admin: ReturnType<typeof createAdminClient>,
  service: AttendanceService,
) {
  const memberData = await readAll(admin
    .from("members")
    .select(
      "id, first_name, middle_name, last_name, member_status, is_archived, church_branch_id, church_branches(name)",
    )
    .eq("church_branch_id", service.churchBranchId)
    .eq("is_archived", false)
    .eq("member_status", "active")
    .order("id"));

  const members = (memberData ?? []) as unknown as MemberRow[];
  const eligibleIds = new Set(members.map((member) => member.id));
  // The service is already authorized by loadAccessibleService. Its recorded
  // facts anchor history, independent of today's member roster.
  const attendanceRows = await readAll(admin.from("attendance_records")
    .select("id, member_id, attendance_status, check_in_time, method, recorded_by")
    .eq("service_id", service.id).order("id")) as AttendanceRow[];
  const historicalIds = [...new Set(attendanceRows.map((row) => row.member_id))]
    .filter((id) => !eligibleIds.has(id));
  for (let start = 0; start < historicalIds.length; start += 100) {
    const historicalMembers = await readAll(admin.from("members")
      .select("id, first_name, middle_name, last_name, member_status, is_archived, church_branch_id, church_branches(name)")
      .in("id", historicalIds.slice(start, start + 100)).order("id"));
    members.push(...historicalMembers as unknown as MemberRow[]);
  }
  const knownIds = new Set(members.map((member) => member.id));
  for (const id of historicalIds) {
    if (!knownIds.has(id)) members.push({ id, first_name: null, middle_name: null,
      last_name: null, member_status: null, is_archived: false, church_branch_id: "" });
  }

  const recorderIds = Array.from(
    new Set(
      attendanceRows
        .map((row) => row.recorded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const profiles = new Map<string, string | null>();

  if (recorderIds.length > 0) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", recorderIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const profile of (data ?? []) as ProfileRow[]) {
      profiles.set(profile.id, profile.display_name);
    }
  }

  const attendanceByMember = new Map<string, AttendanceRecord>();

  for (const row of attendanceRows) {
    if (!ATTENDANCE_STATUSES.includes(row.attendance_status as never)) {
      throw new Error("A historical attendance record has an unsupported status. Review the source data.");
    }

    attendanceByMember.set(row.member_id, {
      id: row.id,
      memberId: row.member_id,
      status: row.attendance_status as AttendanceRecord["status"],
      checkInTime: row.check_in_time,
      method: row.method,
      recordedBy: row.recorded_by,
      recordedByName: row.recorded_by
        ? profiles.get(row.recorded_by) ?? null
        : null,
    });
  }

  const rows: AttendanceMemberRow[] = members.map((member) => {
    const attendanceMember: AttendanceMember = {
      id: member.id,
      firstName: member.first_name,
      middleName: member.middle_name,
      lastName: member.last_name,
      memberStatus: member.member_status,
      isArchived: member.is_archived,
      churchBranchId: member.church_branch_id,
      homeBranchName: member.church_branches?.name ?? "Home branch unknown",
    };

    return {
      member: attendanceMember,
      attendance: attendanceByMember.get(member.id) ?? null,
      isCurrentlyEligible: eligibleIds.has(member.id),
    };
  });

  return rows.sort((a, b) =>
    `${a.member.lastName ?? ""} ${a.member.firstName ?? ""} ${a.member.id}`.localeCompare(
      `${b.member.lastName ?? ""} ${b.member.firstName ?? ""} ${b.member.id}`,
    ),
  );
}

// Exhaust each result set so a transport row cap cannot hide recorded history.
// This does not introduce UI pagination or reconstruct a historical roster.
async function readAll<T>(query: { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }> }) {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await query.range(start, start + 499);
    if (error) throw new Error("Unable to load service attendance.");
    result.push(...data ?? []);
    if ((data?.length ?? 0) < 500) return result;
  }
}
