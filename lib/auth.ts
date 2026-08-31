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

export async function getCurrentUserRoles(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      roles (
        name
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user roles:", error);
    return [];
  }

  return (
    data?.flatMap((userRole) => {
      const relatedRoles = Array.isArray(userRole.roles)
        ? userRole.roles
        : userRole.roles
          ? [userRole.roles]
          : [];

      return relatedRoles
        .map((role) => role.name)
        .filter((roleName): roleName is string => typeof roleName === "string");
    }) ?? []
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
