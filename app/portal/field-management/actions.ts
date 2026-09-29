"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";

export async function updateFieldSetting(
  fieldId: string,
  setting: "is_required" | "is_visible",
  value: boolean,
) {
  await requirePortalTab("field_management");

  const admin = createAdminClient();

  const { error } = await admin
    .from("member_field_definitions")
    .update({
      [setting]: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fieldId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/field-management");
}