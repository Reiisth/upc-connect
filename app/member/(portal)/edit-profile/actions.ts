"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateMemberProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/member/login");
  }

  const cookieStore = await cookies();
  const selectedMemberId = cookieStore.get("selected_member_id")?.value;

  if (!selectedMemberId) {
    redirect("/member/select-profile");
  }

  const { data: memberLink, error: memberLinkError } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("member_id", selectedMemberId)
    .eq("relationship", "member")
    .maybeSingle();

  if (memberLinkError) {
    throw new Error(memberLinkError.message);
  }

  if (!memberLink) {
    redirect("/member/select-profile");
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const birthDateValue = String(formData.get("birth_date") ?? "").trim();
  const attendanceDateValue = String(
    formData.get("first_attendance_date") ?? "",
  ).trim();

  if (birthDateValue && new Date(birthDateValue) > today) {
    throw new Error("Birth date cannot be in the future.");
  }

  if (attendanceDateValue && new Date(attendanceDateValue) > today) {
    throw new Error("First attendance date cannot be in the future.");
  }

  const civilStatus = String(
    formData.get("civil_status") ?? "",
  ).trim();

  const { error } = await supabase
    .from("members")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      middle_name:
        String(formData.get("middle_name") ?? "").trim() || null,
      last_name: String(formData.get("last_name") ?? "").trim(),
      nickname: String(formData.get("nickname") ?? "").trim() || null,
      birth_date: birthDateValue || null,
      gender: String(formData.get("gender") ?? "").trim() || null,
      civil_status: civilStatus || null,
      zone:
        String(formData.get("zone") ?? "").trim()
          ? Number(formData.get("zone"))
          : null,
      phone_number:
        String(formData.get("phone_number") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || null,
      street_address:
        String(formData.get("street_address") ?? "").trim() || null,
      province:
        String(formData.get("province") ?? "").trim() || null,
      city:
        String(formData.get("city") ?? "").trim() || null,
      barangay:
        String(formData.get("barangay") ?? "").trim() || null,
      church_branch_id:
        String(formData.get("church_branch_id") ?? "").trim() || null,
      department_id:
        String(formData.get("department_id") ?? "").trim() || null,
      position:
        String(formData.get("position") ?? "").trim() || null,
      first_attendance_date: attendanceDateValue || null,
      wedding_anniversary:
        civilStatus === "single"
          ? null
          : String(
            formData.get("wedding_anniversary") ?? "",
          ).trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", selectedMemberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/member", "layout");
  redirect("/member");
}