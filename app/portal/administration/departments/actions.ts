"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdministrationPermission } from "../access";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizedName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new Error("Department name is required.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Department name is required.");
  if (name.length > 120) throw new Error("Department name must be 120 characters or fewer.");
  return name;
}

function requireDepartmentId(value: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error("A department is required.");
  return value.trim();
}

function revalidateDepartmentRoutes() {
  revalidatePath("/portal/administration");
  revalidatePath("/portal/administration/departments");
  revalidatePath("/portal/members");
  revalidatePath("/portal/members/new");
}

function translateUniqueError(error: { code?: string }) {
  if (error.code === "23505") throw new Error("A department with that name already exists.");
}

export async function createDepartment(formData: FormData) {
  await requireAdministrationPermission("departments.manage");
  const name = normalizedName(formData.get("name"));
  const admin = createAdminClient();
  const { error } = await admin.from("departments").insert({
    name,
    is_active: true,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    translateUniqueError(error);
    throw new Error("The department could not be created.");
  }
  revalidateDepartmentRoutes();
  redirect("/portal/administration/departments");
}

export async function updateDepartment(departmentId: string, formData: FormData) {
  await requireAdministrationPermission("departments.manage");
  const id = requireDepartmentId(departmentId);
  const name = normalizedName(formData.get("name"));
  const admin = createAdminClient();
  const { data, error } = await admin.from("departments")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    translateUniqueError(error);
    throw new Error("The department could not be updated.");
  }
  if (!data) throw new Error("The requested department could not be found.");
  revalidateDepartmentRoutes();
  redirect("/portal/administration/departments");
}

export async function setDepartmentActive(departmentId: string, isActive: boolean) {
  await requireAdministrationPermission("departments.manage");
  const id = requireDepartmentId(departmentId);
  if (typeof isActive !== "boolean") throw new Error("Invalid department status.");
  const admin = createAdminClient();
  const { data, error } = await admin.from("departments")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("The department status could not be changed.");
  if (!data) throw new Error("The requested department could not be found.");
  revalidateDepartmentRoutes();
}
