import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembersPermission, type MemberPermission } from "./access";

export async function requireStaffMember(memberId: string, permission: MemberPermission) {
  const access = await requireMembersPermission(permission);
  const admin = createAdminClient();
  let query = admin.from("members").select("*").eq("id", memberId);
  if (!access.isSystemAdmin) query = query.in("church_branch_id", access.branchIds);
  const { data: member, error } = await query.maybeSingle();
  if (error || !member) redirect("/access-denied");
  return { access, admin, member };
}
