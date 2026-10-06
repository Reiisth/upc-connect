"use server";

import { revalidatePath } from "next/cache";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateStaffBranchAccess(
  userId: string,
  branchIds: string[],
) {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    throw new Error(
      "You do not have permission to manage staff branch access.",
    );
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from("user_branch_access")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (branchIds.length > 0) {
    const { error: insertError } = await admin
      .from("user_branch_access")
      .insert(
        branchIds.map((branchId) => ({
          user_id: userId,
          church_branch_id: branchId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidatePath(
    "/portal/administration/staff-branch-access",
  );

  revalidatePath("/portal/members");
}