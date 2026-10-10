"use server";

import { updateStaffBranchAccessFromAccount } from "@/app/portal/accounts/staff/actions";

export async function updateStaffBranchAccess(
  userId: string,
  branchIds: string[],
) {
  // Keep this legacy Administration route on the canonical Accounts
  // branch-access mutation so permission and branch-scope validation cannot
  // drift between the two entry points.
  return updateStaffBranchAccessFromAccount(userId, branchIds);
}
