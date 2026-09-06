import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import MemberProfileForm from "./member-profile-form";

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-muted-foreground">
          Loading...
        </p>
      }
    >
      <MemberProfileContent params={params} />
    </Suspense>
  );
}

async function MemberProfileContent({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
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
    redirect("/auth/error?error=Member profile not linked to this account");
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    redirect("/auth/error?error=Member profile not found");
  }

  const { data: branches, error: branchesError } = await supabase
    .from("church_branches")
    .select("id, name")
    .order("name");

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  if (departmentsError) {
    throw new Error(departmentsError.message);
  }

  async function updateProfile(formData: FormData) {
    "use server";

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
      redirect("/auth/error?error=Member profile not linked to this account");
    }

    const zoneValue = String(formData.get("zone") ?? "").trim();

    const { error } = await supabase
      .from("members")
      .update({
        first_name:
          String(formData.get("first_name") ?? "").trim(),

        last_name:
          String(formData.get("last_name") ?? "").trim(),


        middle_name:
          String(formData.get("middle_name") ?? "").trim() || null,

        nickname:
          String(formData.get("nickname") ?? "").trim() || null,

        birth_date:
          String(formData.get("birth_date") ?? "") || null,

        gender:
          String(formData.get("gender") ?? "") || null,

        civil_status:
          String(formData.get("civil_status") ?? "").trim() || null,

        zone: zoneValue ? Number(zoneValue) : null,

        phone_number:
          String(formData.get("phone_number") ?? "").trim() || null,

        street_address:
          String(formData.get("street_address") ?? "").trim() || null,

        barangay:
          String(formData.get("barangay") ?? "").trim() || null,

        city:
          String(formData.get("city") ?? "").trim() || null,

        province:
          String(formData.get("province") ?? "").trim() || null,

        country:
          String(formData.get("country") ?? "").trim() || null,

        wedding_anniversary:
          ["married", "widowed"].includes(
            String(formData.get("civil_status") ?? ""),
          )
            ? String(formData.get("wedding_anniversary") ?? "") || null
            : null,

        first_attendance_date:
          String(formData.get("first_attendance_date") ?? "") || null,

        department:
          String(formData.get("department") ?? "").trim() || null,

        position:
          String(formData.get("position") ?? "").trim() || null,

        church_branch_id:
          String(formData.get("church_branch_id") ?? "").trim() || null,

        account_status: "connected",
        profile_status: "completed",
        profile_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      throw new Error(error.message);
    }

    redirect("/member/select-profile");
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-[#5D94E8]">
            Member Profile
          </p>

          <h1 className="mt-2 font-body text-3xl font-semibold text-[#203264]">
            Complete profile for {member.first_name} {member.last_name}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Fill in the member information below.
          </p>
        </div>

        <MemberProfileForm
          member={member}
          accountEmail={user.email ?? ""}
          branches={branches ?? []}
          departments={departments ?? []}
          action={updateProfile}
        />
      </div>
    </main>
  );
}