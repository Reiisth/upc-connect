"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";

export async function archiveMemberAccount(userId: string) {
  await requirePortalTab("accounts");

  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/accounts/members");
}

export async function restoreMemberAccount(userId: string) {
  await requirePortalTab("accounts");

  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      archived_at: null,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/accounts/members");
}