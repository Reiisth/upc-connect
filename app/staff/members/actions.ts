"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function inviteMember(memberId: string, email: string) {
  await requireRole("system_admin");

  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    throw new Error("Not authenticated");
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error) {
    throw new Error(error.message);
  }

  const invitedUserId = data.user.id;

  const { error: linkError } = await admin.rpc("link_invited_member", {
    p_member_id: memberId,
    p_user_id: invitedUserId,
    p_invited_by: currentUser.id,
  });

  if (linkError) {
    await admin.auth.admin.deleteUser(invitedUserId);

    throw new Error(linkError.message);
  }

  return { success: true };
}