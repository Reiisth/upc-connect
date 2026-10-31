import "server-only";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";

export async function requireOwnedProfile(
  memberId: string,
  permission: "profile.view" | "profile.update",
) {
  const access = await requirePermission(permission);
  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", access.user.id)
    .eq("member_id", memberId)
    .eq("relationship", "member")
    .maybeSingle();

  // Same response for a missing relationship and a failed lookup. Never load
  // the member itself until permission and ownership have both been verified.
  if (error || !link) redirect("/access-denied");
  return { ...access, supabase };
}
