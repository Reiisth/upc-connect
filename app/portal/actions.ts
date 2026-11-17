"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getPortalBranchContext } from "@/lib/portal-branch-server";
import { PORTAL_BRANCH_COOKIE } from "@/lib/portal-branch";

export async function selectPortalBranch(branchId: string) {
  const context = await getPortalBranchContext();
  if (branchId !== "all" && !context.branches.some(branch => branch.id === branchId)) return {error:"That branch is no longer available to your account."};
  (await cookies()).set(PORTAL_BRANCH_COOKIE,JSON.stringify({userId:context.userId,branchId:branchId === "all" ? null : branchId}), {
    httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV === "production",path:"/",maxAge:60*60*24*365,
  });
  return {error:null};
}

export async function logoutPortal() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  (await cookies()).delete(PORTAL_BRANCH_COOKIE);

  redirect("/login");
}
