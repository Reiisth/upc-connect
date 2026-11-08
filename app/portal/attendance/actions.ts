"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseManilaDateTime, toManilaDateTimeValue } from "@/lib/manila-time";
import { assertServiceAttendance } from "../services/lifecycle";

import {
  getAttendanceBranchContext,
  requireAttendancePermission,
} from "./access";
import { loadAccessibleService } from "./data";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type QrAttendanceResult,
} from "./types";

const attendancePath = "/portal/attendance";
const memberQrIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getFormText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function parseCheckInTime(
  value: string,
  status: AttendanceStatus,
) {
  if (!value) {
    return status !== "present"
      ? null
      : new Date().toISOString();
  }

  return parseManilaDateTime(value);
}

function getAttendanceStatus(formData: FormData) {
  const value = getFormText(formData, "attendance_status") as AttendanceStatus;

  if (!ATTENDANCE_STATUSES.includes(value)) {
    throw new Error("Select a valid attendance status.");
  }

  return value;
}

async function updateAttendanceRecord(
  admin: ReturnType<typeof createAdminClient>,
  recordId: string,
  serviceId: string,
  payload: {
    attendance_status: AttendanceStatus;
    method: string;
    check_in_time: string | null;
    recorded_by: string;
  },
) {
  const { data, error } = await admin
    .from("attendance_records")
    .update(payload)
    .eq("id", recordId).eq("service_id", serviceId)
    .select("id").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) throw new Error("The attendance record changed or was removed. Refresh and try again.");
}

function parseMemberQrValue(value: string) {
  const normalizedValue = value.trim();

  if (
    normalizedValue.length > 100 ||
    !memberQrIdPattern.test(normalizedValue)
  ) {
    throw new Error(
      "This QR code is not a valid UPC Connect member code.",
    );
  }

  return normalizedValue;
}

function getMemberName(member: {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}) {
  return [
    member.first_name,
    member.middle_name,
    member.last_name,
  ]
    .filter(Boolean)
    .join(" ") || "Unnamed member";
}

function getDuplicateResult(
  memberName: string,
  record: {
    attendance_status: string;
    check_in_time: string | null;
    method: string | null;
  },
): QrAttendanceResult {
  return {
    outcome: "duplicate",
    memberName,
    attendanceStatus: record.attendance_status as AttendanceStatus,
    checkInTime: record.check_in_time,
    method: record.method,
  };
}

export async function recordQrAttendance(
  serviceId: string,
  qrValue: string,
): Promise<QrAttendanceResult> {
  const access = await requireAttendancePermission(
    "attendance.record",
  );

  if (!serviceId) {
    throw new Error("A service is required before scanning.");
  }

  const memberId = parseMemberQrValue(qrValue);
  const admin = createAdminClient();
  const service = await loadAccessibleService(
    access,
    admin,
    serviceId,
  );

  if (!service) {
    throw new Error(
      "The selected service was not found or is outside your branch access.",
    );
  }

  assertServiceAttendance(service.status, "record");

  const { data: member, error: memberError } = await admin
    .from("members")
    .select(
      "id, first_name, middle_name, last_name, church_branch_id, member_status, is_archived, church_branches(name)",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error("Unable to verify this Member. Try again.");
  }

  if (!member) {
    throw new Error(
      "This QR code does not belong to a recognized member.",
    );
  }

  if (
    member.is_archived ||
    !["active", "inactive"].includes(member.member_status ?? "")
  ) {
    throw new Error(
      "This member is not eligible for attendance at the selected service.",
    );
  }

  const memberName = getMemberName(member);
  const identityContext = {
    memberStatus: member.member_status,
    visitingMember: Boolean(member.church_branch_id && member.church_branch_id !== service.churchBranchId),
    homeBranchName: (member.church_branches as unknown as { name: string } | null)?.name ?? "Unassigned home branch",
  };
  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select(
      "id, attendance_status, check_in_time, method",
    )
    .eq("service_id", serviceId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingError) {
    throw new Error("Unable to check existing attendance. Try again.");
  }

  if (existing) {
    return { ...getDuplicateResult(memberName, existing), ...identityContext };
  }

  const latestService = await loadAccessibleService(access, admin, serviceId);
  if (!latestService) throw new Error("Service is outside your branch access.");
  assertServiceAttendance(latestService.status, "record");
  const checkInTime = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("attendance_records")
    .insert({
      service_id: serviceId,
      member_id: memberId,
      attendance_status: "present",
      method: "qr",
      recorded_by: access.user.id,
      check_in_time: checkInTime,
    }).select("id").single();

  if (insertError) {
    if (insertError.code !== "23505") {
      throw new Error("Attendance could not be saved. Try again.");
    }

    // Another scan may have won the unique(service_id, member_id) race.
    // Re-read it and report a duplicate without overwriting it.
    const { data: concurrent, error: concurrentError } = await admin
      .from("attendance_records")
      .select(
        "id, attendance_status, check_in_time, method",
      )
      .eq("service_id", serviceId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (concurrentError) {
      throw new Error("Unable to check existing attendance. Try again.");
    }

    if (!concurrent) {
      throw new Error(
        "The QR attendance record could not be saved. Please try again.",
      );
    }

    return { ...getDuplicateResult(memberName, concurrent), ...identityContext };
  }

  revalidatePath(attendancePath);
  revalidatePath(`${attendancePath}/${serviceId}`);
  revalidatePath(`/portal/services/${serviceId}/attendance`);
  revalidatePath("/portal/reports");
  revalidatePath("/portal/inactivity");

  return {
    outcome: "recorded",
    recordId: inserted?.id,
    ...identityContext,
    memberName,
    attendanceStatus: "present",
    checkInTime,
  };
}

export async function saveAttendanceRecord(
  serviceId: string,
  formData: FormData,
) {
  const branchContext = await getAttendanceBranchContext();

  if (!serviceId) {
    throw new Error("A service is required.");
  }

  const memberId = getFormText(formData, "member_id");

  if (!memberId) {
    throw new Error("Select a member.");
  }

  const attendanceStatus = getAttendanceStatus(formData);
  const checkInTime = parseCheckInTime(
    getFormText(formData, "check_in_time"),
    attendanceStatus,
  );
  const admin = createAdminClient();
  const service = await loadAccessibleService(
    branchContext,
    admin,
    serviceId,
  );

  if (!service) {
    throw new Error(
      "The selected service was not found or is outside your branch access.",
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select("id, check_in_time")
    .eq("service_id", serviceId).eq("member_id", memberId).maybeSingle();
  if (existingError) throw new Error("Unable to check existing attendance. Try again.");

  const requestedRecordId = getFormText(formData, "attendance_record_id");
  if (requestedRecordId && requestedRecordId !== existing?.id) {
    throw new Error("The selected historical attendance record is no longer available.");
  }
  const operation = existing ? "correct" : "record";
  const access = await requireAttendancePermission(
    existing ? "attendance.correct" : "attendance.record",
  );
  const authorizedService = await loadAccessibleService(access, admin, serviceId);
  if (!authorizedService) {
    throw new Error("The selected service was not found or is outside your branch access.");
  }
  assertServiceAttendance(authorizedService.status, operation);

  if (!existing) {
    const { data: member, error: memberError } = await admin.from("members")
      .select("id, church_branch_id, member_status, is_archived").eq("id", memberId).maybeSingle();
    if (memberError) throw new Error("Unable to verify this Member. Try again.");
    if (!member || member.is_archived || !["active", "inactive"].includes(member.member_status ?? "")) {
      throw new Error("New attendance requires a non-archived Active or Inactive member.");
    }
  }
  // The record's service is the correction scope. Today's member branch,
  // archive status and stored status do not rewrite that historical fact.
  const suppliedTime = getFormText(formData, "check_in_time");
  const preservedTime = existing?.check_in_time && suppliedTime &&
    toManilaDateTimeValue(existing.check_in_time) === toManilaDateTimeValue(checkInTime ?? "")
      ? existing.check_in_time : checkInTime;

  const payload = {
    attendance_status: attendanceStatus,
    method: "manual",
    check_in_time: preservedTime,
    recorded_by: access.user.id,
  };

  const latestService = await loadAccessibleService(access, admin, serviceId);
  if (!latestService) throw new Error("Service is outside your branch access.");
  assertServiceAttendance(latestService.status, operation);
  if (existing?.id) {
    await updateAttendanceRecord(
      admin,
      existing.id,
      serviceId,
      payload,
    );
  } else {
    const { error: insertError } = await admin
      .from("attendance_records")
      .insert({
        service_id: serviceId,
        member_id: memberId,
        ...payload,
      });

    if (insertError) {
      if (insertError.code !== "23505") {
        throw new Error("Attendance could not be saved. Try again.");
      }

      // A concurrent insert won the unique(service_id, member_id) race.
      // Re-read it and apply this correction instead of creating a duplicate.
      const { data: concurrent, error: concurrentError } =
        await admin
          .from("attendance_records")
          .select("id")
          .eq("service_id", serviceId)
          .eq("member_id", memberId)
          .maybeSingle();

      if (concurrentError) {
        throw new Error("Unable to check existing attendance. Try again.");
      }

      if (!concurrent?.id) {
        throw new Error(
          "The attendance record could not be saved. Please try again.",
        );
      }

      const correctionAccess = await requireAttendancePermission(
        "attendance.correct",
      );

      const correctionService = await loadAccessibleService(correctionAccess, admin, serviceId);
      if (!correctionService) throw new Error("Service is outside your branch access.");
      assertServiceAttendance(correctionService.status, "correct");
      await updateAttendanceRecord(admin, concurrent.id, serviceId, {
        ...payload,
        recorded_by: correctionAccess.user.id,
      });
    }
  }

  revalidatePath(attendancePath);
  revalidatePath(`${attendancePath}/${serviceId}`);
  revalidatePath(`/portal/services/${serviceId}/attendance`);
  revalidatePath("/portal/reports");
  revalidatePath("/portal/inactivity");

  return { success: true };
}

/** Purpose-limited identity lookup; no members.view or home-branch grant is implied. */
export async function searchAttendanceMembers(serviceId: string, search: string, branchId: string) {
  const access = await requireAttendancePermission("attendance.record");
  const admin = createAdminClient();
  const service = await loadAccessibleService(access, admin, serviceId);
  if (!service) throw new Error("Service is outside your branch access.");
  assertServiceAttendance(service.status, "record");
  if (!memberQrIdPattern.test(branchId)) return [];
  const term = search.trim().replace(/[^\p{L}\p{N} '-]/gu, "").slice(0, 80);
  if (term.length < 2) return [];
  const { data, error } = await admin.from("members")
    .select("id, first_name, middle_name, last_name, church_branch_id, member_status, church_branches(name)")
    .eq("church_branch_id", branchId)
    .eq("is_archived", false).in("member_status", ["active", "inactive"])
    .or(`first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%`)
    .order("last_name").order("id").limit(30);
  if (error) throw new Error("Unable to search member identities.");
  return (data ?? []).map(member => ({
    id: member.id, firstName: member.first_name, middleName: member.middle_name,
    lastName: member.last_name, churchBranchId: member.church_branch_id ?? "",
    homeBranchName: (member.church_branches as unknown as { name: string } | null)?.name ?? "Unassigned home branch",
    memberStatus: member.member_status, isArchived: false,
  }));
}
