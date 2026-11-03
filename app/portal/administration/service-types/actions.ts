"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdministrationPermission } from "../access";
import { createAdminClient } from "@/lib/supabase/admin";

function nameFrom(data: FormData) {
  const value = data.get("name");
  if (typeof value !== "string") throw new Error("Service type name is required.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw new Error("Enter a service type name of 1 to 120 characters.");
  return name;
}
function keyFrom(name: string) {
  const key = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80).replace(/_+$/g, "");
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(key)) throw new Error("The name cannot produce a valid service type key.");
  return key;
}
function duplicate(error: { code?: string }) { if (error.code === "23505") throw new Error("A service type with that name or key already exists."); }
function refresh() { revalidatePath("/portal/administration"); revalidatePath("/portal/administration/service-types"); revalidatePath("/portal/services"); revalidatePath("/portal/attendance"); revalidatePath("/portal/reports"); }

export async function createServiceType(data: FormData) {
  await requireAdministrationPermission("service_types.manage");
  const name = nameFrom(data); const admin = createAdminClient();
  const { error } = await admin.from("service_types").insert({ key: keyFrom(name), name, is_active: true });
  if (error) { duplicate(error); throw new Error("The service type could not be created."); }
  refresh(); redirect("/portal/administration/service-types");
}
export async function updateServiceType(key: string, data: FormData) {
  await requireAdministrationPermission("service_types.manage");
  const name = nameFrom(data); const admin = createAdminClient();
  const { data: row, error } = await admin.from("service_types").update({ name, updated_at: new Date().toISOString() }).eq("key", key).select("key").maybeSingle();
  if (error) { duplicate(error); throw new Error("The service type could not be updated."); }
  if (!row) throw new Error("The requested service type could not be found.");
  refresh(); redirect("/portal/administration/service-types");
}
export async function setServiceTypeActive(key: string, isActive: boolean) {
  await requireAdministrationPermission("service_types.manage");
  if (typeof isActive !== "boolean" || !/^[a-z][a-z0-9_]{0,79}$/.test(key)) throw new Error("Invalid service type request.");
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_types").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("key", key).select("key").maybeSingle();
  if (error || !data) throw new Error("The service type status could not be changed.");
  refresh();
}
