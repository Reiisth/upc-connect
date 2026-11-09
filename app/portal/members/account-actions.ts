"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireStaffMember } from "./data";
import { requireAccountsPermission } from "../accounts/access";
import { requireAccountTarget } from "../accounts/target-scope";

export async function saveLinkedAccount(memberId: string, _state: { error: string | null; saved?: boolean }, form: FormData): Promise<{ error: string | null; saved?: boolean }> {
  const { admin } = await requireStaffMember(memberId, "members.view");
  try {
    const { data: link, error: linkError } = await admin.from("account_members").select("user_id").eq("member_id", memberId).eq("relationship", "member").maybeSingle();
    if (linkError || !link) return { error: "This member has no linked account." };
    const { data: profile, error: profileError } = await admin.from("profiles").select("display_name,archived_at").eq("id", link.user_id).maybeSingle();
    if (profileError || !profile || profile.archived_at) return { error: "The linked account is unavailable or archived." };
    const displayName = String(form.get("display_name") ?? "").trim();
    if (form.has("email")) return { error: "Account email cannot be edited here." };
    if (!displayName || displayName.length > 200) return { error: "Enter a display name of 200 characters or fewer." };
    await requireAccountTarget(await requireAccountsPermission("accounts.update_display_name"), admin, link.user_id);
    const nameChanged = displayName !== (profile.display_name ?? "");
    if (nameChanged) {
      const { data: changed, error } = await admin.from("profiles").update({ display_name: displayName }).eq("id", link.user_id).is("archived_at", null).select("id").maybeSingle();
      if (error || !changed) return { error: "The account display name could not be saved." };
    }
    revalidatePath("/portal/members", "layout");
    revalidatePath("/portal/accounts", "layout");
    revalidatePath("/portal/account");
    return { error: null, saved: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "The account information could not be saved." };
  }
}
