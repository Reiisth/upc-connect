"use server";

import { requireActiveAccount } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";

export async function setAccountPassword(password: string) {
  const { user } = await requireActiveAccount();
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const permissions = await getCurrentUserPermissions(user.id);
  const supabase = await createClient();
  const { data: links, error: linkError } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("relationship", "member");
  if (linkError) return { error: "Unable to verify your linked profiles. Please try again." };

  const memberIds = (links ?? []).map((link) => link.member_id);
  // Operational capabilities are permission keys, never role names. The
  // portal resolver remains responsible for selecting the actual workspace.
  const hasOperationalAccess = permissions.some((permission) =>
    !permission.startsWith("profile."),
  );
  const hasProfileAccess = hasPermission(permissions, "profile.view") && memberIds.length > 0;
  if (!hasOperationalAccess && !hasProfileAccess) {
    return { destination: "/access-denied" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Your password could not be saved. Please try again." };

  if (hasProfileAccess) {
    const { error: updateError } = await supabase.from("members")
      .update({ account_status: "connected", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", memberIds);
    if (updateError) return { error: "Your password was saved, but profile activation could not be completed. Please try again." };
  }

  return { destination: hasOperationalAccess ? "/portal" : "/portal/profile" };
}
