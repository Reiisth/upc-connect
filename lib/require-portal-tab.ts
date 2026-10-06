import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { getCurrentUser, getCurrentUserRoles } from "@/lib/auth";
import {
  canAccessTab,
  type PortalTab,
} from "@/lib/portal-access";

async function getUserBranchAccess(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_branch_access")
    .select(`
      church_branch_id,
      church_branch:church_branches (
        id,
        name,
        code
      )
    `)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function requirePortalTab(tab: PortalTab) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (!canAccessTab(roles, tab)) {
    redirect("/access-denied");
  }

  const isSystemAdmin = roles.includes("system_admin");

  let branches;

  if (isSystemAdmin) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("church_branches")
      .select(`
      id,
      name,
      code
    `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    branches = data ?? [];
  } else {
    const branchAccess = await getUserBranchAccess(user.id);

    branches = branchAccess
      .map((item) => {
        const branch = Array.isArray(item.church_branch)
          ? item.church_branch[0] ?? null
          : item.church_branch ?? null;

        return branch;
      })
      .filter(
        (
          branch,
        ): branch is {
          id: string;
          name: string;
          code: string | null;
        } => branch !== null,
      );
  }

  return {
    user,
    roles,
    branches,
  };
}