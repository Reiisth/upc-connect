import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalUserContext = {
  displayName: string;
  roles: { key: string; displayName: string }[];
  branches: string[];
  hasAllBranches: boolean;
};

const loadPortalUserContext = cache(async (
  userId: string,
  fallbackName: string,
): Promise<PortalUserContext> => {
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: roleLinks, error: roleError }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("roles!inner(key, display_name, is_active)").eq("user_id", userId),
  ]);
  if (profileError || roleError) throw new Error("Unable to load account context.");

  const roleMap = new Map<string, string>();
  for (const link of roleLinks ?? []) {
    const relation = link.roles;
    const role = Array.isArray(relation) ? relation[0] : relation;
    if (!role?.is_active || !role.key) continue;
    roleMap.set(role.key, role.display_name?.trim() || formatRole(role.key));
  }
  const roles = [...roleMap].map(([key, displayName]) => ({ key, displayName }));
  const hasAllBranches = roles.some((role) => role.key === "system_admin");

  let branches: string[] = [];
  if (!hasAllBranches) {
    const { data, error } = await admin
      .from("user_branch_access")
      .select("church_branch:church_branches!inner(name, is_active)")
      .eq("user_id", userId)
      .eq("church_branch.is_active", true);
    if (error) throw new Error("Unable to load branch access.");
    branches = [...new Set((data ?? []).flatMap((assignment) => {
      const relation = assignment.church_branch;
      const branch = Array.isArray(relation) ? relation[0] : relation;
      return branch?.is_active && branch.name ? [branch.name] : [];
    }))].sort((a, b) => a.localeCompare(b));
  }

  return {
    displayName: profile?.display_name?.trim() || fallbackName,
    roles,
    branches,
    hasAllBranches,
  };
});

export function getPortalUserContext(userId: string, fallbackName: string) {
  return loadPortalUserContext(userId, fallbackName);
}

function formatRole(key: string) {
  return key.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
