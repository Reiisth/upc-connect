"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, unstable_rethrow } from "next/navigation";

import { assertActiveServiceBranch } from "../services/access";
import { requireMembersPermission } from "./access";
import { requireStaffMember } from "./data";
import { validateChurchMember } from "./validation";
import { getAccountTargetScopes } from "../accounts/target-scope";
import { hasPermission } from "@/lib/permissions";

export async function createMember(formData: FormData) {
  const access = await requireMembersPermission("members.create");

  const payload = validateChurchMember(formData, { creating: true });

  const admin = createAdminClient();
  await assertActiveServiceBranch(
    admin,
    access,
    payload.church_branch_id,
  );

  await validateDepartment(admin, payload.department_id);
  const { data, error } = await admin.from("members").insert(payload).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/members");
  redirect(hasPermission(access.permissions, "members.view") ? `/portal/members/${data.id}`
    : hasPermission(access.permissions, "members.update") ? `/portal/members/${data.id}/edit` : "/portal/members/new?created=1");
}

async function validateDepartment(admin: ReturnType<typeof createAdminClient>, departmentId: string | null, allowCurrentInactive = false) {
  if (!departmentId) return;
  const { data, error } = await admin.from("departments").select("id, is_active").eq("id", departmentId).maybeSingle();
  if (error || !data || !data.is_active && !allowCurrentInactive) throw new Error("Select an active department.");
}

function refreshMember(memberId: string) {
  for (const path of ["/portal/members", `/portal/members/${memberId}`, `/portal/members/${memberId}/edit`,
    "/portal/profile", `/portal/profile/${memberId}`, "/portal/inactivity", "/portal/reports", "/portal/attendance"]) revalidatePath(path);
}

async function saveChurchInformation(memberId: string, form: FormData) {
  const { member, access, admin } = await requireStaffMember(memberId, "members.update");
  if (member.is_archived) throw new Error("Restore the member before editing church information.");
  const validated = validateChurchMember(form, { identity: member });
  const payload = { church_branch_id: validated.church_branch_id, first_attendance_date: validated.first_attendance_date,
    member_status: validated.member_status, department_id: validated.department_id, position: validated.position, zone: validated.zone };
  if (member.church_branch_id || !access.isSystemAdmin) await assertActiveServiceBranch(admin, access, member.church_branch_id ?? "");
  await assertActiveServiceBranch(admin, access, payload.church_branch_id);
  await validateDepartment(admin, payload.department_id, payload.department_id === member.department_id);
  let query = admin.from("members").update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", memberId).eq("is_archived", false);
  query = member.church_branch_id ? query.eq("church_branch_id", member.church_branch_id) : query.is("church_branch_id", null);
  const { data: saved, error } = await query.select("id").maybeSingle();
  if (error || !saved) throw new Error("The member could not be updated. Reload the record and try again.");
  refreshMember(memberId);
  return access;
}

export async function updateMember(memberId: string, form: FormData) {
  const access = await saveChurchInformation(memberId, form);
  redirect(hasPermission(access.permissions, "members.view") ? `/portal/members/${memberId}` : `/portal/members/${memberId}/edit`);
}

export async function saveMemberChurchInformation(memberId: string, _state: { error: string | null; saved?: boolean }, form: FormData): Promise<{ error: string | null; saved?: boolean }> {
  try { await saveChurchInformation(memberId, form); return { error: null, saved: true }; }
  catch (error) { unstable_rethrow(error); return { error: error instanceof Error ? error.message : "Unable to save church information." }; }
}

export async function restoreMember(memberId: string) {
  const { member, access, admin } = await requireStaffMember(memberId, "members.archive");
  await assertActiveServiceBranch(admin, access, member.church_branch_id ?? "");
  const { data: saved, error } = await admin.from("members").update({ is_archived: false, archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", memberId).eq("church_branch_id", member.church_branch_id).select("id").maybeSingle();
  if (error || !saved) throw new Error("The member could not be restored. Reload the record and try again.");
  refreshMember(memberId);
}

export async function archiveMember(memberId: string) {
  const { member, access, admin } = await requireStaffMember(memberId, "members.archive");

  await assertActiveServiceBranch(
    admin,
    access,
    member.church_branch_id ?? "",
  );

  const { data: saved, error } = await admin
    .from("members")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId).eq("church_branch_id", member.church_branch_id).select("id").maybeSingle();

  if (error || !saved) {
    throw new Error("The member could not be archived. Reload the record and try again.");
  }

  refreshMember(memberId);
}

export async function inviteMembers(memberIds: string[], email: string, returnMemberId?: string) {
  const access = await requireMembersPermission(
    "members.link_account",
  );

  if (!Array.isArray(memberIds) || memberIds.some((value) => typeof value !== "string") || typeof email !== "string") throw new Error("Invalid account connection request.");
  const uniqueMemberIds = Array.from(new Set(memberIds));

  if (uniqueMemberIds.length === 0) {
    throw new Error("Select at least one member.");
  }

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("An account email is required.");
  }

  for (const memberId of uniqueMemberIds) {
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, church_branch_id, is_archived")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      throw new Error("The selected member could not be found.");
    }

    if (member.is_archived) {
      throw new Error(
        "Archived members cannot be connected to an account.",
      );
    }

    await assertActiveServiceBranch(
      admin,
      access,
      member.church_branch_id ?? "",
    );
  }

  let existingUserId: string | null = null;

  let page = 1;

  while (!existingUserId) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

    if (existingUser) {
      existingUserId = existingUser.id;
      break;
    }

    if (data.users.length < 1000) {
      break;
    }

    page++;
  }

  if (existingUserId) {
    const target = (await getAccountTargetScopes(access, admin, existingUserId)).get(existingUserId);
    if (!target || !target.canViewMembers && !target.canViewStaff) redirect("/access-denied");
    const { data: profile, error: profileError } = await admin.from("profiles").select("archived_at").eq("id", existingUserId).maybeSingle();
    if (profileError || !profile || profile.archived_at) throw new Error("This account is unavailable for connection.");
  }

  let userId = existingUserId;
  let newlyInvited = false;

  if (!userId) {
    const { data, error } =
      await admin.auth.admin.inviteUserByEmail(normalizedEmail);

    if (error) {
      throw new Error(error.message);
    }

    userId = data.user.id;
    newlyInvited = true;
  }

  for (const memberId of uniqueMemberIds) {
    const { data: memberLink, error: memberLinkError } = await admin
      .from("account_members")
      .select("id, user_id")
      .eq("member_id", memberId)
      .eq("relationship", "member")
      .maybeSingle();

    if (memberLinkError) {
      throw new Error(memberLinkError.message);
    }

    if (memberLink && memberLink.user_id !== userId) {
      throw new Error(
        "This member is already connected to a different account.",
      );
    }

    if (memberLink && memberLink.user_id === userId) {
      continue;
    }

    const { error } = await admin.rpc("link_invited_member", {
      p_member_id: memberId,
      p_user_id: userId,
      p_invited_by: access.user.id,
    });

    if (error) {
      if (newlyInvited) {
        await admin.auth.admin.deleteUser(userId);
      }

      throw new Error(error.message);
    }

    const { error: statusError } = await admin
      .from("members")
      .update({
        account_status: newlyInvited ? "invited" : "connected",
      })
      .eq("id", memberId);

    if (statusError) {
      throw new Error(statusError.message);
    }

  }

  revalidatePath("/portal/accounts/members");

  if (userId) {
    revalidatePath(`/portal/accounts/${userId}`);
  }

  if (returnMemberId && uniqueMemberIds.includes(returnMemberId) && hasPermission(access.permissions, "members.view")) {
    refreshMember(returnMemberId);
    redirect('/portal/members/' + returnMemberId);
  }
  redirect("/portal/members");
}

export async function disconnectMember(memberId: string) {
  const access = await requireMembersPermission(
    "members.link_account",
  );

  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, church_branch_id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("The requested member could not be found.");
  }

  await assertActiveServiceBranch(
    admin,
    access,
    member.church_branch_id ?? "",
  );

  const { data: memberLink, error: memberLinkError } = await admin
    .from("account_members")
    .select("user_id")
    .eq("member_id", memberId)
    .eq("relationship", "member")
    .limit(1)
    .maybeSingle();

  if (memberLinkError) {
    throw new Error(memberLinkError.message);
  }

  const { error: linkError } = await admin
    .from("account_members")
    .delete()
    .eq("member_id", memberId)
    .eq("relationship", "member");

  if (linkError) {
    throw new Error(linkError.message);
  }

  const { error: memberUpdateError } = await admin
    .from("members")
    .update({
      account_status: "no_account",
      invited_at: null,
      invited_by: null,
      accepted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (memberUpdateError) {
    throw new Error(memberUpdateError.message);
  }

  revalidatePath("/portal/accounts/members");

  if (memberLink?.user_id) {
    revalidatePath(`/portal/accounts/${memberLink.user_id}`);
  }

  redirect("/portal/members");
}
