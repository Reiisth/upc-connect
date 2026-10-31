"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwnedProfile } from "./access";
import { getMemberFieldDefinitions } from "@/lib/member-fields";
import { isProfileDefinition } from "@/lib/member-field-policy";
import { validateSelfServiceProfile, type ProfileOptions } from "@/lib/member-validation";

export async function saveMemberProfile(memberId: string, form: FormData) {
  const { supabase, user, permissions } = await requireOwnedProfile(memberId, "profile.update");
  const { data: member, error } = await supabase.from("members").select("*").eq("id", memberId).single();
  if (error || !member || member.is_archived) throw new Error("This member profile is unavailable for editing.");
  const definitions = (await getMemberFieldDefinitions()).filter(isProfileDefinition);
  const [{ data: branches, error: branchError }, { data: departments, error: departmentError }] = await Promise.all([
    supabase.from("church_branches").select("id"), supabase.from("departments").select("id"),
  ]);
  if (branchError || departmentError) throw new Error("Unable to verify profile choices.");
  const catalog: ProfileOptions = { branches: (branches ?? []).map((row) => row.id), departments: (departments ?? []).map((row) => row.id), regions: [] };
  if (definitions.some((field) => field.is_visible && field.options_source === "psgc_regions" &&
      (form.get(field.is_builtin ? field.field_key : `custom_field_${field.id}`) || member[field.field_key]))) {
    const token = process.env.PSA_API_KEY;
    if (!token) throw new Error("Region choices cannot be verified right now. Please try again later.");
    const response = await fetch(`https://classification.psa.gov.ph/psgc/Q2_2024/regions?token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Region choices cannot be verified right now. Please try again later.");
    const data = await response.json();
    catalog.regions = (data.results ?? []).map((row: { area_name: string; reg: number }) => ({ name: row.area_name, regionNumber: row.reg }));
  }
  let validated;
  try { validated = validateSelfServiceProfile(form, definitions, member, catalog, user.email ?? ""); }
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
  redirect(permissions.includes("profile.view") ? `/portal/profile/${memberId}` : `/portal/profile/${memberId}/edit`);
}
