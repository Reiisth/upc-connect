"use server";

import { requireActiveAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const { user } = await requireActiveAccount();
  if (typeof currentPassword !== "string" || !currentPassword ||
      typeof newPassword !== "string" || newPassword.length < 8 || newPassword === currentPassword) {
    return { error: "Enter your current password and a different new password of at least 8 characters." };
  }
  if (!user.email) return { error: "Unable to verify your account email." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email, password: currentPassword,
  });
  if (error || data.user?.id !== user.id) return { error: "Current password is incorrect." };
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return { error: "Your password could not be changed. Please try again." };
  return { success: true };
}
