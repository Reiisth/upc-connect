import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type StaffRole } from "@/lib/staff-roles";

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentUserRoles(userId?: string) {
  const targetUserId =
    userId ?? (await getCurrentUser())?.id;

  if (!targetUserId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      roles (
        name
      )
    `)
    .eq("user_id", targetUserId);

  if (error) {
    throw new Error(error.message);
  }

  return (
    data
      ?.map((item) => item.roles?.[0]?.name)
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
