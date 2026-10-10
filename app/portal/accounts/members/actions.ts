"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSystemAdminChangeSafe,
  requireAccountsPermission,
} from "../access";

export async function archiveMemberAccount(userId: string) {
  const { user: currentUser } = await requireAccountsPermission(
    "accounts.archive",
  );

  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    throw new Error("The requested account does not exist.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, archived_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("The requested account profile does not exist.");
  }

  if (profile.archived_at) {
    throw new Error("This member account is already archived.");
  }

  await assertSystemAdminChangeSafe(
    admin,
    userId,
    currentUser.id,
    "archive",
  );

  const { error } = await admin
    .from("profiles")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/accounts/members");
  revalidatePath(`/portal/accounts/${userId}`);
  revalidatePath("/portal/accounts/staff");
  revalidatePath(`/portal/accounts/staff/${userId}`);
}

export async function restoreMemberAccount(userId: string) {
  await requireAccountsPermission("accounts.restore");

  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    throw new Error("The requested account does not exist.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, archived_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("The requested account profile does not exist.");
  }

  if (!profile.archived_at) {
    throw new Error("This member account is already active.");
  }

  const { error } = await admin
    .from("profiles")
    .update({
      archived_at: null,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/portal/accounts/members");
  revalidatePath(`/portal/accounts/${userId}`);
  revalidatePath("/portal/accounts/staff");
  revalidatePath(`/portal/accounts/staff/${userId}`);
}
