"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

import { loadAccessibleService } from "./data";
import {
  ATTENDANCE_STATUSES,
  canScanServiceStatus,
  type AttendanceStatus,
  type QrAttendanceResult,
} from "./types";
import { requireServicesAccess } from "../services/access";

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
    return status === "excused"
      ? null
      : new Date().toISOString();
  }

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(
      value,
    )
  ) {
    throw new Error("Enter a valid check-in time.");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid check-in time.");
  }

  return parsed.toISOString();
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
  payload: {
    attendance_status: AttendanceStatus;
    method: string;
    check_in_time: string | null;
    recorded_by: string;
  },
) {
  const { error } = await admin
    .from("attendance_records")
    .update(payload)
    .eq("id", recordId);

  if (error) {
    throw new Error(error.message);
  }
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
  const access = await requireServicesAccess();

  if (access.isSystemAdmin || !access.roles.includes("usher")) {
    throw new Error(
      "Only ushers can record attendance with QR scanning.",
    );
  }

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

  if (!canScanServiceStatus(service.status)) {
    if (service.status === "cancelled") {
      throw new Error(
        "QR attendance is not available for cancelled services.",
      );
    }

    if (service.status === "completed") {
      throw new Error(
        "QR attendance is closed for completed services.",
      );
    }

    throw new Error(
      "QR attendance is not available for this service status.",
    );
  }

  const { data: member, error: memberError } = await admin
    .from("members")
    .select(
      "id, first_name, middle_name, last_name, church_branch_id, member_status, is_archived",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error(
      "This QR code does not belong to a recognized member.",
    );
  }

  if (
    member.church_branch_id !== service.churchBranchId ||
    member.is_archived ||
    member.member_status !== "active"
  ) {
    throw new Error(
      "This member is not eligible for attendance at the selected service.",
    );
  }

  const memberName = getMemberName(member);
  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select(
      "id, attendance_status, check_in_time, method",
    )
    .eq("service_id", serviceId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return getDuplicateResult(memberName, existing);
  }

  const checkInTime = new Date().toISOString();
  const { error: insertError } = await admin
    .from("attendance_records")
    .insert({
      service_id: serviceId,
      member_id: memberId,
      attendance_status: "present",
      method: "qr",
      recorded_by: access.user.id,
      check_in_time: checkInTime,
    });

  if (insertError) {
    if (insertError.code !== "23505") {
      throw new Error(insertError.message);
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
      throw new Error(concurrentError.message);
    }

    if (!concurrent) {
      throw new Error(
        "The QR attendance record could not be saved. Please try again.",
      );
    }

    return getDuplicateResult(memberName, concurrent);
  }

  revalidatePath(attendancePath);
  revalidatePath(`${attendancePath}/${serviceId}`);

  return {
    outcome: "recorded",
    memberName,
    attendanceStatus: "present",
    checkInTime,
  };
}

export async function saveAttendanceRecord(
  serviceId: string,
  formData: FormData,
) {
  const access = await requireServicesAccess();

  if (
    access.isSystemAdmin ||
    (!access.roles.includes("usher") &&
      !access.roles.includes("pastor"))
  ) {
    throw new Error(
      "Your account has view-only access to attendance records.",
    );
  }

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
    access,
    admin,
    serviceId,
  );

  if (!service) {
    throw new Error(
      "The selected service was not found or is outside your branch access.",
    );
  }

  const { data: member, error: memberError } = await admin
    .from("members")
    .select(
      "id, church_branch_id, member_status, is_archived",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("The selected member could not be found.");
  }

  if (member.church_branch_id !== service.churchBranchId) {
    throw new Error(
      "The selected member does not belong to the service branch.",
    );
  }

  if (member.is_archived || member.member_status !== "active") {
    throw new Error(
      "Attendance can only be recorded for active members.",
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("attendance_records")
    .select("id")
    .eq("service_id", serviceId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const payload = {
    attendance_status: attendanceStatus,
    method: "manual",
    check_in_time: checkInTime,
    recorded_by: access.user.id,
  };

  if (existing?.id) {
    await updateAttendanceRecord(
      admin,
      existing.id,
      payload,
    );
  } else {
    if (!access.roles.includes("usher")) {
      throw new Error(
        "Pastors can correct existing attendance records but cannot add a new record.",
      );
    }

    const { error: insertError } = await admin
      .from("attendance_records")
      .insert({
        service_id: serviceId,
        member_id: memberId,
        ...payload,
      });

    if (insertError) {
      if (insertError.code !== "23505") {
        throw new Error(insertError.message);
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
        throw new Error(concurrentError.message);
      }

      if (!concurrent?.id) {
        throw new Error(
          "The attendance record could not be saved. Please try again.",
        );
      }

      await updateAttendanceRecord(
        admin,
        concurrent.id,
        payload,
      );
    }
  }

  revalidatePath(attendancePath);
  revalidatePath(`${attendancePath}/${serviceId}`);

  return { success: true };
}
