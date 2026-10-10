"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

import { assertActiveServiceBranch } from "../services/access";
import { requireMembersPermission } from "./access";

export async function createMember(formData: FormData) {
  const access = await requireMembersPermission("members.create");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const churchBranchId = String(
    formData.get("church_branch_id") ?? "",
  ).trim();

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  const admin = createAdminClient();
  await assertActiveServiceBranch(
    admin,
    access,
    churchBranchId,
  );

  const { error } = await admin.from("members").insert({
    first_name: firstName,
    last_name: lastName,
    church_branch_id: churchBranchId,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/portal/members");
}

export async function archiveMember(memberId: string) {
  const access = await requireMembersPermission("members.archive");

  const admin = createAdminClient();

  const { data: member, error: memberLookupError } = await admin
    .from("members")
    .select("id, church_branch_id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberLookupError) {
    throw new Error(memberLookupError.message);
  }

  if (!member) {
    throw new Error("The requested member could not be found.");
  }

  await assertActiveServiceBranch(
    admin,
    access,
    member.church_branch_id ?? "",
  );

  const { error } = await admin
    .from("members")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/members");
}

export async function inviteMembers(memberIds: string[], email: string) {
  const access = await requireMembersPermission(
    "members.link_account",
  );

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

    const { error: emailError } = await admin
      .from("members")
      .update({
        email: normalizedEmail,
      })
      .eq("id", memberId);

    if (emailError) {
      throw new Error(emailError.message);
    }
  }

  revalidatePath("/portal/accounts/members");

  if (userId) {
    revalidatePath(`/portal/accounts/${userId}`);
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
      email: null,
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
