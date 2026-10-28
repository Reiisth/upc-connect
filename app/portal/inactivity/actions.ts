"use server";

import { revalidatePath } from "next/cache";
import { getUserBranchScope } from "@/lib/branch-access";
import { requirePermission } from "@/lib/permissions-server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InactivitySettingsState = {
  status: "idle" | "error" | "success";
  message: string;
};

/** This action accepts only the threshold, never an arbitrary branch patch. */
export async function updateInactivityThreshold(
  branchId: string,
  _previousState: InactivitySettingsState,
  formData: FormData,
): Promise<InactivitySettingsState> {
  const access = await requirePermission("inactivity.manage_settings");
  const scope = await getUserBranchScope(access.user.id);
  if (!scope.branchIds.includes(branchId)) {
    return { status: "error", message: "You can only change settings for branches assigned to your account." };
  }

  const raw = formData.get("inactivity_threshold_weeks");
  const threshold = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 52) {
    return { status: "error", message: "Enter a whole number of weeks from 1 to 52." };
  }

  // Branch table policies stay unchanged. The privileged client is used only
  // after current-account permission and branch-scope validation.
  const admin = createAdminClient();
  const { data, error } = await admin.from("church_branches")
    .update({ inactivity_threshold_weeks: threshold })
    .eq("id", branchId).eq("is_active", true).select("id").maybeSingle();
  if (error) {
    console.error("Inactivity threshold update failed.", error);
    return { status: "error", message: "The inactivity rule could not be saved. Please try again." };
  }
  if (!data) {
    return { status: "error", message: "The selected branch does not exist or is inactive." };
  }

  revalidatePath("/portal/inactivity");
  return { status: "success", message: `Inactivity rule saved: ${threshold} consecutive absent ${threshold === 1 ? "week" : "weeks"}. Results have been refreshed.` };
}
