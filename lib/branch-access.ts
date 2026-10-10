import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BranchScope = {
  branchIds: string[];
  isSystemAdmin: boolean;
};

/**
 * Resolve the authenticated user's branch scope without deciding whether
 * they have permission to use a particular module.
 *
 * system_admin is intentionally special-cased here only because that role
 * has global branch scope. Operational authorization remains permission-based
 * in the modules that have migrated to permissions.
 */
export async function getUserBranchScope(
  userId: string,
): Promise<BranchScope> {
  const supabase = await createClient();

  const { data: roleLinks, error: roleError } = await supabase
    .from("user_roles")
    .select(`
      roles!inner (
        key,
        is_active
      )
    `)
    .eq("user_id", userId);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const isSystemAdmin = (roleLinks ?? []).some((link) => {
    const role = Array.isArray(link.roles)
      ? link.roles[0] ?? null
      : link.roles;

    return role?.is_active === true && role.key === "system_admin";
  });

  if (isSystemAdmin) {
    const { data: branches, error: branchError } = await supabase
      .from("church_branches")
      .select("id")
      .eq("is_active", true);

    if (branchError) {
      throw new Error(branchError.message);
    }

    return {
      branchIds: (branches ?? []).map((branch) => branch.id),
      isSystemAdmin: true,
    };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("user_branch_access")
    .select("church_branch_id")
    .eq("user_id", userId);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  return {
    branchIds: (assignments ?? []).map(
      (assignment) => assignment.church_branch_id,
    ),
    isSystemAdmin: false,
  };
}
