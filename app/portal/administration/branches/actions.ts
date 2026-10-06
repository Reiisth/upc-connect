"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createBranch(formData: FormData) {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    throw new Error("You do not have permission to create church branches.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  const streetAddress = String(
    formData.get("street_address") ?? "",
  ).trim();

  const barangay = String(
    formData.get("barangay") ?? "",
  ).trim();

  const city = String(
    formData.get("city") ?? "",
  ).trim();

  const province = String(
    formData.get("province") ?? "",
  ).trim();

  const country =
    String(formData.get("country") ?? "").trim() || "Philippines";

  if (!name) {
    throw new Error("Branch name is required.");
  }

  if (!code) {
    throw new Error("Branch code is required.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("church_branches")
    .insert({
      name,
      code,
      street_address: streetAddress || null,
      barangay: barangay || null,
      city: city || null,
      province: province || null,
      country: country || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("That branch code is already in use.");
    }

    throw new Error(error.message);
  }

  revalidatePath("/portal/administration");
  revalidatePath("/portal/administration/branches");

  redirect("/portal/administration/branches");
}

export async function setBranchActive(
  branchId: string,
  isActive: boolean,
) {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    throw new Error(
      "You do not have permission to change branch status.",
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("church_branches")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/administration");
  revalidatePath("/portal/administration/branches");
}

export async function updateBranch(
  branchId: string,
  formData: FormData,
) {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    throw new Error("You do not have permission to edit church branches.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  const streetAddress = String(
    formData.get("street_address") ?? "",
  ).trim();

  const barangay = String(
    formData.get("barangay") ?? "",
  ).trim();

  const city = String(
    formData.get("city") ?? "",
  ).trim();

  const province = String(
    formData.get("province") ?? "",
  ).trim();

  const country = String(
    formData.get("country") ?? "",
  ).trim();

  if (!branchId) {
    throw new Error("Branch ID is required.");
  }

  if (!name) {
    throw new Error("Branch name is required.");
  }

  if (!code) {
    throw new Error("Branch code is required.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("church_branches")
    .update({
      name,
      code,
      street_address: streetAddress || null,
      barangay: barangay || null,
      city: city || null,
      province: province || null,
      country: country || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("That branch code is already in use.");
    }

    throw new Error(error.message);
  }

  revalidatePath("/portal/administration");
  revalidatePath("/portal/administration/branches");
  revalidatePath(`/portal/administration/branches/${branchId}/edit`);

  redirect("/portal/administration/branches");
}