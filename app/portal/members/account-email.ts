import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUsersByIds } from "../accounts/auth-users";

/** Call only after scoped Member authorization. Project the linked account email,
 * never an Auth object or directory, to the Member view. */
export async function loadMemberAccountEmail(admin: ReturnType<typeof createAdminClient>, memberId: string) {
  const { data: link, error } = await admin.from("account_members").select("user_id")
    .eq("member_id", memberId).eq("relationship", "member").maybeSingle();
  if (error) throw new Error("Unable to load account connection.");
  if (!link) return null;
  const user = (await getAuthUsersByIds(admin, [link.user_id])).get(link.user_id);
  if (!user) throw new Error("Unable to load linked account.");
  return { userId: link.user_id, email: user.email ?? null };
}
