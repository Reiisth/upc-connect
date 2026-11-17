import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireActiveAccount } from "./auth";
import { getUserBranchScope } from "./branch-access";
import { getHistoricalRecordBranches } from "./historical-records";
import { createAdminClient } from "./supabase/admin";
import { PORTAL_BRANCH_COOKIE, resolvePortalBranch } from "./portal-branch";

/** View context only. Never replace the full authorization scope with this selection. */
export const getPortalBranchContext = cache(async () => {
  const { user } = await requireActiveAccount();
  const scope = await getUserBranchScope(user.id);
  const branches = await getHistoricalRecordBranches(scope,createAdminClient());
  const cookie = (await cookies()).get(PORTAL_BRANCH_COOKIE)?.value;
  return { userId:user.id, scope, branches, branchId:resolvePortalBranch(cookie,user.id,branches) };
});

export async function getPortalBranchId() { return (await getPortalBranchContext()).branchId; }

export async function selectPortalBranches<T extends {id:string}>(branches: readonly T[]): Promise<T[]> {
  const branchId = await getPortalBranchId();
  return branchId ? branches.filter(branch => branch.id === branchId) : [...branches];
}
