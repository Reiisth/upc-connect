import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import {
  getUserBranchScope,
  type BranchScope,
} from "@/lib/branch-access";

export type AttendancePermission =
  | "attendance.view"
  | "attendance.record"
  | "attendance.correct";

export type AttendanceAccess = PermissionContext & BranchScope;

export type AttendanceBranchContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
} & BranchScope;

export async function requireAttendancePermission(
  permission: AttendancePermission,
): Promise<AttendanceAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}

/**
 * Resolve authentication and branch scope for the small amount of server-side
 * inspection needed before a save can determine whether it is a new record or
 * a correction. The mutation still calls requireAttendancePermission() for
 * the exact operation before writing.
 */
export async function getAttendanceBranchContext(): Promise<AttendanceBranchContext> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const branchScope = await getUserBranchScope(user.id);

  return {
    user,
    ...branchScope,
  };
}
