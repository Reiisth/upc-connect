"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createMember(formData: FormData) {
  await requireRole("system_admin");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  const admin = createAdminClient();

  const { error } = await admin.from("members").insert({
    first_name: firstName,
    last_name: lastName,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/staff/admin/members");
}

export async function inviteMembers(memberIds: string[], email: string) {
  await requireRole("system_admin");

  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    throw new Error("Not authenticated.");
  }

  if (memberIds.length === 0) {
    throw new Error("Select at least one member.");
  }

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

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

  for (const memberId of memberIds) {
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
      p_invited_by: currentUser.id,
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

  redirect("/staff/admin/members");
}

export async function disconnectMember(memberId: string) {
  await requireRole("system_admin");

  const admin = createAdminClient();

  const { error: linkError } = await admin
    .from("account_members")
    .delete()
    .eq("member_id", memberId)
    .eq("relationship", "member");

  if (linkError) {
    throw new Error(linkError.message);
  }

  const { error: memberError } = await admin
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

  if (memberError) {
    throw new Error(memberError.message);
  }

  redirect("/staff/admin/members");
}