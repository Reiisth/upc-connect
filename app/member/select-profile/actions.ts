"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function selectMemberProfile(memberId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/member/login");
  }

  const { data: link } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("member_id", memberId)
    .eq("relationship", "member")
    .maybeSingle();

  if (!link) {
    throw new Error("This member profile is not linked to your account.");
  }

  const cookieStore = await cookies();

  cookieStore.set("selected_member_id", memberId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/member");
}