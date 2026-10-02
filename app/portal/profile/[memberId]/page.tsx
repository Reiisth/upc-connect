import { Suspense } from "react";
import { redirect } from "next/navigation";
import ProfileMemberSkeleton from "./ProfileMemberSkeleton";
import IncompleteProfileSkeleton from "./IncompleteProfileSkeleton";
import MemberCard from "../../components/MemberCard";
import EditProfileButton from "./EditProfileButton";

import { createClient } from "@/lib/supabase/server";
import { getMemberFieldDefinitions } from "@/lib/member-fields";
import MemberProfileForm from "../../components/MemberProfileForm";

type PageProps = {
  params: Promise<{
    memberId: string;
  }>;
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function MemberProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { status } = await searchParams;

  const fallback =
    status === "incomplete" ? (
      <IncompleteProfileSkeleton />
    ) : (
      <ProfileMemberSkeleton />
    );

  return (
    <Suspense fallback={fallback}>
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

  const fieldDefinitions = await getMemberFieldDefinitions();

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
      redirect("/login");
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

    const region =
      String(formData.get("region") ?? "").trim();

    const provinceValue =
      String(formData.get("province") ?? "").trim();

    const province = provinceValue || null;

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

        province,

        region: region || null,

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

        department_id:
          String(formData.get("department_id") ?? "").trim() || null,
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

    redirect("/portal/profile");
  }

  if (member.profile_status !== "completed") {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-[#5D94E8]">
            Profile
          </p>

          <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
            Complete Profile
          </h1>

          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Complete the profile information for{" "}
            <span className="font-medium text-[#203264]">
              {member.first_name} {member.last_name}
            </span>
            .
          </p>
        </div>

        <MemberProfileForm
          member={member}
          accountEmail={user.email ?? ""}
          branches={branches ?? []}
          departments={departments ?? []}
          fieldDefinitions={fieldDefinitions}
          action={updateProfile}
        />
      </div>
    );
  };
  const memberDepartment = departments.find(
    (department) => department.id === member.department_id,
  );

  const memberBranch = branches.find(
    (branch) => branch.id === member.church_branch_id,
  );

  return (
    <div className="mx-auto w-full">
      <div className="mb-6">
        <p className="text-sm font-medium text-[#5D94E8]">
          Profile
        </p>

        <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
          Member Profile
        </h1>

        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          View your member card and profile information.
        </p>
      </div>

      <div className="flex flex-col items-center">
        <MemberCard
          showBackToProfiles={true}
          member={{
            ...member,
            department: memberDepartment
              ? { name: memberDepartment.name }
              : null,
            church_branch: memberBranch
              ? { name: memberBranch.name }
              : null,
          }}
        />

        <EditProfileButton memberId={memberId} />
      </div>
    </div>
  );
}