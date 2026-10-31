import "server-only";

import type { BranchScope } from "./branch-access";
import { createAdminClient } from "./supabase/admin";

/** Historical records remain attributable to an assigned branch even after it closes. */
export async function getHistoricalRecordBranches(access: BranchScope, admin: ReturnType<typeof createAdminClient>) {
  if (!access.isSystemAdmin && !access.branchIds.length) return [];
  let query = admin.from("church_branches").select("id, name, code, is_active");
  if (!access.isSystemAdmin) query = query.in("id", access.branchIds);
  const { data, error } = await query.order("name");
  if (error) throw new Error("Unable to verify historical branch access.");
  return (data ?? []).map((branch) => ({ id: branch.id, name: branch.name, code: branch.code, isActive: branch.is_active }));
}

export async function assertHistoricalRecordBranch(admin: ReturnType<typeof createAdminClient>, access: BranchScope, branchId: string) {
  if (!branchId) throw new Error("A church branch is required.");
  if (!access.isSystemAdmin && !access.branchIds.includes(branchId)) {
    throw new Error("You can only use church branches assigned to your account.");
  }
  const { data, error } = await admin.from("church_branches").select("id").eq("id", branchId).maybeSingle();
  if (error || !data) throw new Error("Unable to verify historical branch access.");
}
