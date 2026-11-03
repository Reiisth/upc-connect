"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertServiceTransition } from "./lifecycle";

import {
  assertActiveServiceBranch,
  requireServicesPermission,
} from "./access";
import {
  SERVICE_STATUSES,
  type ServiceStatus,
  type ServiceType,
} from "./types";

const servicesPath = "/portal/services";

function getFormText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Enter a valid service date.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid service date.");
  }

  return value;
}

function validateTime(value: string) {
  if (!value) return null;

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new Error("Enter a valid start time.");
  }

  return value;
}

function validateServiceForm(formData: FormData) {
  const name = getFormText(formData, "name");
  const serviceType = getFormText(
    formData,
    "service_type",
  ) as ServiceType;
  const serviceDate = getFormText(formData, "service_date");
  const startTime = getFormText(formData, "start_time");
  const status = getFormText(formData, "status") as ServiceStatus;
  const churchBranchId = getFormText(
    formData,
    "church_branch_id",
  );
  const notes = getFormText(formData, "notes");

  if (!name) {
    throw new Error("Service name is required.");
  }

  if (name.length > 200) {
    throw new Error("Service name must be 200 characters or fewer.");
  }

  if (!/^[a-z][a-z0-9_]{0,79}$/.test(serviceType)) throw new Error("Select a valid service type.");

  if (!SERVICE_STATUSES.includes(status)) {
    throw new Error("Select a valid service status.");
  }

  return {
    name,
    service_type: serviceType,
    service_date: validateDate(serviceDate),
    start_time: validateTime(startTime),
    status,
    church_branch_id: churchBranchId,
    notes: notes || null,
  };
}

export async function createService(formData: FormData) {
  const access = await requireServicesPermission("services.create");
  const payload = validateServiceForm(formData);
  const admin = createAdminClient();
  const { data: type, error: typeError } = await admin.from("service_types").select("key").eq("key", payload.service_type).eq("is_active", true).maybeSingle();
  if (typeError || !type) throw new Error("Select an active service type.");

  await assertActiveServiceBranch(
    admin,
    access,
    payload.church_branch_id,
  );

  const { data, error } = await admin
    .from("services")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(servicesPath);

  if (data?.id) {
    revalidatePath(`${servicesPath}/${data.id}/edit`);
  }

  redirect(servicesPath);
}

export async function updateService(
  serviceId: string,
  formData: FormData,
) {
  const access = await requireServicesPermission("services.update");

  if (!serviceId) {
    throw new Error("A service is required.");
  }

  const payload = validateServiceForm(formData);
  const admin = createAdminClient();

  const { data: currentService, error: currentError } =
    await admin
      .from("services")
      .select("id, church_branch_id, service_date, status, service_type")
      .eq("id", serviceId)
      .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (!currentService) {
    throw new Error("The requested service could not be found.");
  }
  if (payload.service_type !== currentService.service_type) {
    const { data: type, error: typeError } = await admin.from("service_types").select("key").eq("key", payload.service_type).eq("is_active", true).maybeSingle();
    if (typeError || !type) throw new Error("Select an active service type.");
  }

  await assertActiveServiceBranch(
    admin,
    access,
    currentService.church_branch_id,
  );
  await assertActiveServiceBranch(
    admin,
    access,
    payload.church_branch_id,
  );

  assertServiceTransition(currentService.status as ServiceStatus, payload.status);
  const branchChanged = currentService.church_branch_id !== payload.church_branch_id;
  const dateChanged = currentService.service_date !== payload.service_date;
  if (branchChanged || dateChanged) {
    const [attendance, contributions] = await Promise.all([
      admin.from("attendance_records").select("id").eq("service_id", serviceId).limit(1),
      branchChanged
        ? admin.from("financial_contributions").select("id").eq("service_id", serviceId).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (attendance.error || contributions.error) {
      throw new Error("Unable to verify the service's historical records.");
    }
    if (branchChanged && (attendance.data?.length || contributions.data?.length)) {
      throw new Error("The service branch cannot change after attendance or linked contributions exist.");
    }
    if (dateChanged && attendance.data?.length) {
      throw new Error("The service date cannot change after attendance exists.");
    }
  }

  const { data: updated, error } = await admin
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .eq("church_branch_id", currentService.church_branch_id)
    .eq("service_date", currentService.service_date)
    .eq("status", currentService.status)
    .select("id").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!updated) throw new Error("The service changed while saving. Refresh and try again.");

  revalidatePath(servicesPath);
  revalidatePath(`${servicesPath}/${serviceId}/edit`);
  revalidatePath("/portal/attendance");
  revalidatePath(`/portal/attendance/${serviceId}`);

  redirect(servicesPath);
}
