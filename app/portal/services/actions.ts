"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePortalPath as revalidatePath } from "@/lib/portal-invalidation";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertServiceTransition, effectiveStoredServiceStatus } from "./lifecycle";

import {
  assertActiveServiceBranch,
  requireServicesPermission,
} from "./access";
import {
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
  if (!value) throw new Error("Start time is required (Asia/Manila).");

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
  if (getFormText(formData, "status")) throw new Error("Service state is automatic. Use the explicit completion or cancellation action.");
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

  return {
    name,
    service_type: serviceType,
    service_date: validateDate(serviceDate),
    start_time: validateTime(startTime),
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
    .insert({ ...payload, status: effectiveStoredServiceStatus({ ...payload, status: "scheduled" }) })
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
      .select("id, church_branch_id, service_date, start_time, status, service_type")
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

  const assertScheduled = () => {
    if (effectiveStoredServiceStatus(currentService) !== "scheduled") throw new Error("This service has already started or is terminal and can no longer be edited as a scheduled service.");
  };
  assertScheduled();
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

  assertScheduled(); // Re-evaluate at submission after dependency checks, not edit-page time.
  const { data: updated, error } = await admin
    .from("services")
    .update({ ...payload, status: effectiveStoredServiceStatus({ ...payload, status: "scheduled" }) })
    .eq("id", serviceId)
    .eq("church_branch_id", currentService.church_branch_id)
    .eq("service_date", currentService.service_date)
    .eq("status", currentService.status)
    .or(currentService.start_time === null ? "start_time.is.null" : `start_time.eq.${currentService.start_time}`)
    .select("id").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!updated) throw new Error("The service changed while saving. Refresh and try again.");

  revalidatePath(servicesPath);
  revalidatePath(`${servicesPath}/${serviceId}/edit`);
  revalidatePath(`${servicesPath}/${serviceId}`);
  revalidatePath("/portal/attendance");
  revalidatePath(`/portal/attendance/${serviceId}`);

  redirect(servicesPath);
}


export async function finishService(serviceId: string, target: "completed" | "cancelled") {
  const access = await requireServicesPermission("services.update");
  if (target !== "completed" && target !== "cancelled") throw new Error("Select a terminal service action.");
  const admin = createAdminClient();
  const { data: service, error } = await admin.from("services").select("id,church_branch_id,service_date,start_time,status").eq("id",serviceId).maybeSingle();
  if (error || !service) throw new Error("Service not found.");
  await assertActiveServiceBranch(admin, access, service.church_branch_id);
  assertServiceTransition(effectiveStoredServiceStatus(service), target);
  let generatedAbsent=0;
  if(target==="completed"){
    const {data,error:completionError}=await admin.rpc("finalize_service_attendance",{p_service_id:serviceId,p_actor_id:access.user.id,p_preview:false});
    if(completionError)throw new Error("Unable to complete Service. Refresh the attendance review and try again.");
    generatedAbsent=Number(data.generatedAbsent);
  }else{
  const { data: changed, error: writeError } = await admin.from("services").update({status:target})
    .eq("id",service.id).eq("church_branch_id",service.church_branch_id).eq("status",service.status)
    .eq("service_date",service.service_date).or(service.start_time === null ? "start_time.is.null" : `start_time.eq.${service.start_time}`)
    .select("id").maybeSingle();
  if (writeError || !changed) throw new Error("The service changed. Refresh before trying again.");
  }
  for (const path of [servicesPath,`${servicesPath}/${serviceId}`,"/portal/attendance",`/portal/attendance/${serviceId}`,`/portal/services/${serviceId}/edit`,`/portal/services/${serviceId}/attendance`,`/portal/attendance/${serviceId}/scan`,"/portal/reports","/portal/inactivity"]) revalidatePath(path);
  return {success:true,generatedAbsent};
}


export async function previewServiceCompletion(serviceId:string):Promise<{present:number;excused:number;absent:number;missing:number}> {
 const access=await requireServicesPermission("services.update");
 const admin=createAdminClient();
 const {data:service,error}=await admin.from("services").select("id,church_branch_id,service_date,start_time,status").eq("id",serviceId).maybeSingle();
 if(error||!service)throw new Error("Service not found.");
 await assertActiveServiceBranch(admin,access,service.church_branch_id);
 assertServiceTransition(effectiveStoredServiceStatus(service),"completed");
 const {data,error:previewError}=await admin.rpc("finalize_service_attendance",{p_service_id:serviceId,p_actor_id:access.user.id,p_preview:true});
 if(previewError)throw new Error("Unable to review attendance. Refresh and try again.");
 return {present:Number(data.present),excused:Number(data.excused),absent:Number(data.absent),missing:Number(data.missing)};
}

// Expected scheduling failures are returned to the form instead of being
// redacted as production server exceptions. Framework redirects still propagate.
export async function createServiceFormAction(formData: FormData) {
  try { await createService(formData); }
  catch (error) { unstable_rethrow(error); return {error:error instanceof Error ? error.message : "Unable to create Service."}; }
}
export async function updateServiceFormAction(serviceId: string, formData: FormData) {
  try { await updateService(serviceId,formData); }
  catch (error) { unstable_rethrow(error); return {error:error instanceof Error ? error.message : "Unable to update Service."}; }
}
