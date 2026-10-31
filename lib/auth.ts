import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole, type StaffRole } from "@/lib/staff-roles";

export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

// React cache shares this read within one server request only. Never persist
// account state across requests: archive/restore must affect the next request.
export const getActiveAccount = cache(async function getActiveAccount() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("id, archived_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.archived_at !== null) return null;
  return { user, profile };
});

export async function requireActiveAccount() {
  if (!await getCurrentUser()) redirect("/login");
  const account = await getActiveAccount();
  if (!account) redirect("/access-denied");
  return account;
}

export async function getCurrentUserRoles(userId?: string) {
  const account = await getActiveAccount();
  if (!account || (userId && userId !== account.user.id)) return [];
  const targetUserId = account.user.id;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      roles (
        name,
        is_active
      )
    `)
    .eq("user_id", targetUserId);

  if (error) {
    throw new Error(error.message);
  }

  return (
    data
      ?.map((item) => {
        const roles = item.roles as
          | { name: string; is_active: boolean }
          | { name: string; is_active: boolean }[]
          | null;

        if (!roles) return null;

        const role = Array.isArray(roles) ? roles[0] : roles;
        return role?.is_active === true ? role.name : null;
      })
      .filter((role): role is string => Boolean(role)) ?? []
  );
}

export async function requireStaff() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/staff/login");
  }

  const staffRole = await getCurrentStaffRole(user.id);

  if (!staffRole) {
    redirect("/access-denied");
  }

  return {
    user,
    staffRole,
  };
}

export async function getCurrentStaffRole(
  userId: string,
): Promise<StaffRole | null> {
  const roles = await getCurrentUserRoles(userId);
  const staffRoles = roles.filter(isStaffRole);

  // A member role may coexist with one staff role, but multiple staff roles
  // are invalid and must not receive Staff Portal access.
  return staffRoles.length === 1 ? staffRoles[0] : null;
}

export async function requireRole(role: StaffRole) {
  const { user, staffRole } = await requireStaff();

  if (staffRole !== role) {
    redirect("/access-denied");
  }

  return { user, staffRole };
}
