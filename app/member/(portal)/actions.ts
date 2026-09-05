"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logoutMember() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete("selected_member_id");

  redirect("/member/login");
}