"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { requireFollowUpsPermission, type FollowUpAccess } from "./access";
import { FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES, isUuid, isValidDate, type FollowUpActionState, type FollowUpMethod, type FollowUpOutcome } from "./types";

type Admin = ReturnType<typeof createAdminClient>;
class FollowUpValidationError extends Error {}
function text(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function validate(form: FormData) {
  const branchId = text(form, "church_branch_id"), memberId = text(form, "member_id");
  const followUpDate = text(form, "follow_up_date"), nextDate = text(form, "next_follow_up_date");
  const method = text(form, "method") as FollowUpMethod, outcome = text(form, "outcome") as FollowUpOutcome;
  const performer = text(form, "followed_up_by"), notes = text(form, "notes");
  if (!isUuid(branchId) || !isUuid(memberId)) throw new FollowUpValidationError("Select a valid branch and member.");
  if (!isValidDate(followUpDate)) throw new FollowUpValidationError("Enter a valid follow-up date.");
  if (!FOLLOW_UP_METHODS.includes(method)) throw new FollowUpValidationError("Select a valid follow-up method.");
  if (!FOLLOW_UP_OUTCOMES.includes(outcome)) throw new FollowUpValidationError("Select a valid follow-up outcome.");
  if (nextDate && (!isValidDate(nextDate) || nextDate < followUpDate)) throw new FollowUpValidationError("The next follow-up date must be on or after the follow-up date.");
  if (performer && !isUuid(performer)) throw new FollowUpValidationError("Select a valid staff account.");
  if (notes.length > 5000) throw new FollowUpValidationError("Notes must be 5,000 characters or fewer.");
  return { branchId, memberId, fields: { follow_up_date: followUpDate, method, outcome,
    followed_up_by: performer || null, notes: notes || null, next_follow_up_date: nextDate || null } };
}

async function assertBranch(admin: Admin, access: FollowUpAccess, id: string) {
  if (!access.branchIds.includes(id)) throw new FollowUpValidationError("You can only record follow-ups in accessible branches.");
  const { data, error } = await admin.from("church_branches").select("id, is_active").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data?.is_active) throw new FollowUpValidationError("The selected branch does not exist or is inactive.");
}

async function assertPerformer(admin: Admin, id: string | null) {
  if (!id) return; // The schema allows an unspecified performer.
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    admin.from("profiles").select("id, archived_at").eq("id", id).maybeSingle(),
    admin.from("user_roles").select("user_id, roles!inner(is_staff, is_active)")
      .eq("user_id", id).eq("roles.is_staff", true).eq("roles.is_active", true).limit(1),
  ]);
  if (profileError || roleError) throw profileError || roleError;
  if (!profile || profile.archived_at || !roles?.length) {
    throw new FollowUpValidationError("The performer must be a non-archived account with an active staff role, or left unspecified.");
  }
}

function failure(error: unknown): FollowUpActionState {
  if (error instanceof FollowUpValidationError) return { error: error.message };
  console.error("Follow-up save failed", error);
  return { error: "The follow-up could not be saved. Please try again." };
}

function finish(access: FollowUpAccess, memberId: string, recordId: string, edit: boolean): never {
  revalidatePath("/portal/follow-ups");
  revalidatePath(`/portal/follow-ups/member/${memberId}`);
  revalidatePath(`/portal/follow-ups/${recordId}/edit`);
  revalidatePath("/portal/inactivity");
  if (hasPermission(access.permissions, "follow_ups.view")) redirect(`/portal/follow-ups/member/${memberId}?saved=1`);
  redirect(edit ? `/portal/follow-ups/${recordId}/edit?saved=1` : "/portal/follow-ups/new?saved=1");
}

export async function createFollowUp(_state: FollowUpActionState, form: FormData): Promise<FollowUpActionState> {
  const access = await requireFollowUpsPermission("follow_ups.create");
  const admin = createAdminClient();
  let memberId = "", recordId = "";
  try {
    const payload = validate(form);
    await assertBranch(admin, access, payload.branchId);
    const { data: member, error } = await admin.from("members").select("id, church_branch_id").eq("id", payload.memberId).maybeSingle();
    if (error) throw error;
    if (!member || member.church_branch_id !== payload.branchId) throw new FollowUpValidationError("The selected member must belong to the selected branch.");
    await assertPerformer(admin, payload.fields.followed_up_by);
    const result = await admin.from("member_follow_ups").insert({ ...payload.fields,
      member_id: payload.memberId, church_branch_id: payload.branchId, created_by: access.user.id,
    }).select("id").single();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Insert returned no follow-up.");
    recordId = result.data.id; memberId = payload.memberId;
  } catch (error) { return failure(error); }
  finish(access, memberId, recordId, false);
}

export async function updateFollowUp(id: string, _state: FollowUpActionState, form: FormData): Promise<FollowUpActionState> {
  const access = await requireFollowUpsPermission("follow_ups.update");
  const admin = createAdminClient();
  let memberId = "";
  try {
    if (!isUuid(id)) throw new FollowUpValidationError("The requested follow-up could not be found.");
    const { data: existing, error } = await admin.from("member_follow_ups")
      .select("id, member_id, church_branch_id").eq("id", id).in("church_branch_id", access.branchIds).maybeSingle();
    if (error) throw error;
    if (!existing) throw new FollowUpValidationError("The requested follow-up could not be found or is outside your branch access.");
    const payload = validate(form);
    if (payload.memberId !== existing.member_id || payload.branchId !== existing.church_branch_id) {
      throw new FollowUpValidationError("The historical member and branch cannot be changed.");
    }
    await assertBranch(admin, access, existing.church_branch_id);
    // Do not re-check the member's current branch: historical links survive transfers.
    await assertPerformer(admin, payload.fields.followed_up_by);
    const result = await admin.from("member_follow_ups")
      .update({ ...payload.fields, updated_at: new Date().toISOString() })
      .eq("id", id).eq("member_id", existing.member_id).eq("church_branch_id", existing.church_branch_id).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new FollowUpValidationError("This follow-up is no longer available. Reload the page and try again.");
    memberId = existing.member_id;
  } catch (error) { return failure(error); }
  finish(access, memberId, id, true);
}
