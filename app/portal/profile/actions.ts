"use server";

import { revalidatePortalPath as revalidatePath } from "@/lib/portal-invalidation";
import { redirect } from "next/navigation";
import { requireOwnedProfile } from "./access";
import { getMemberFieldDefinitions } from "@/lib/member-fields";
import { isProfileDefinition } from "@/lib/member-field-policy";
import { validateSelfServiceProfile, type ProfileOptions } from "@/lib/member-validation";

export async function saveMemberProfile(memberId: string, form: FormData) {
  const { supabase, permissions } = await requireOwnedProfile(memberId, "profile.update");
  const { data: member, error } = await supabase.from("members").select("*").eq("id", memberId).single();
  if (error || !member || member.is_archived) throw new Error("This member profile is unavailable for editing.");
  const definitions = (await getMemberFieldDefinitions()).filter(isProfileDefinition);
  const [{ data: branches, error: branchError }, { data: departments, error: departmentError }] = await Promise.all([
    supabase.from("church_branches").select("id"), supabase.from("departments").select("id"),
  ]);
  if (branchError || departmentError) throw new Error("Unable to verify profile choices.");
  const catalog: ProfileOptions = { branches: (branches ?? []).map((row) => row.id), departments: (departments ?? []).map((row) => row.id) };
  let validated;
  try { validated = validateSelfServiceProfile(form, definitions, member, catalog); }
  catch (validationError) { return { error: validationError instanceof Error ? validationError.message : "Review the profile fields." }; }
  // Validate all fields first; mark the base profile complete only after every
  // supplemental value was saved. These remain two requests, not a transaction.
  if (validated.values.length) {
    const { error: customError } = await supabase.from("member_custom_field_values")
      .upsert(validated.values.map((value) => ({ ...value, member_id: memberId, updated_at: new Date().toISOString() })),
        { onConflict: "member_id,field_definition_id" });
    if (customError) return { error: "Supplemental profile fields could not be saved. Your base profile was not changed." };
  }
  const { data: saved, error: saveError } = await supabase.from("members").update({
    ...validated.patch, profile_status: "completed",
    profile_completed_at: member.profile_completed_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", memberId).eq("is_archived", false).select("id").maybeSingle();
  if (saveError || !saved) return { error: "Your personal profile could not be saved. Supplemental fields may have saved; please retry." };
  revalidatePath("/portal/profile");
  revalidatePath(`/portal/profile/${memberId}`);
  revalidatePath("/portal/members");
  revalidatePath(`/portal/members/${memberId}`);
  revalidatePath("/portal/reports");
  revalidatePath("/portal/inactivity");
  redirect(permissions.includes("profile.view") ? `/portal/profile/${memberId}` : `/portal/profile/${memberId}/edit`);
}
