import { Suspense } from "react";
import { redirect } from "next/navigation";
import ProfileMemberSkeleton from "./ProfileMemberSkeleton";
import MemberCard from "../../components/MemberCard";
import EditProfileButton from "./EditProfileButton";
import { UserRound } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { requireOwnedProfile } from "../access";
import { hasPermission } from "@/lib/permissions";
import { saveMemberProfile } from "../actions";
import { isProfileDefinition } from "@/lib/member-field-policy";
import { getMemberFieldDefinitions } from "@/lib/member-fields";
import MemberProfileForm from "../../components/MemberProfileForm";

type PageProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export default async function MemberProfilePage({
  params,
}: PageProps) {
  return (
    <Suspense fallback={<ProfileMemberSkeleton />}>
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
  const { user, supabase, permissions } = await requireOwnedProfile(memberId, "profile.view");

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

  const fieldDefinitions = (await getMemberFieldDefinitions()).filter(isProfileDefinition);

  if (departmentsError) {
    throw new Error(departmentsError.message);
  }

  const updateProfile = saveMemberProfile.bind(null, memberId);

  const { data: customValues, error: customError } = await supabase.from("member_custom_field_values")
    .select("field_definition_id, value").eq("member_id", memberId);
  if (customError) throw new Error("Unable to load supplemental profile fields.");
  const customValueMap = Object.fromEntries((customValues ?? []).map((row) => [row.field_definition_id, row.value]));

  if (!member.is_archived && member.profile_status !== "completed" && hasPermission(permissions, "profile.update")) {
    return (
      <PageContainer className="max-w-5xl">
        <PageHeader
          backHref="/portal/profile"
          backLabel="Back to Profiles"
          eyebrow="Member Profile"
          eyebrowIcon={<UserRound className="h-4 w-4" />}
          title="Complete Profile"
          description={`Complete the profile information for ${member.first_name} ${member.last_name}.`}
        />

        <MemberProfileForm
          member={member}
          accountEmail={user.email ?? ""}
          branches={branches ?? []}
          departments={departments ?? []}
          fieldDefinitions={fieldDefinitions}
          customFieldValues={customValueMap}
          action={updateProfile}
        />
      </PageContainer>
    );
  }
  const memberDepartment = departments.find(
    (department) => department.id === member.department_id,
  );

  const memberBranch = branches.find(
    (branch) => branch.id === member.church_branch_id,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/profile"
        backLabel="Back to Profiles"
        eyebrow="Member Profile"
        eyebrowIcon={<UserRound className="h-4 w-4" />}
        title="Member Profile"
        description="View your member card and profile information."
      />

      <div className="flex flex-col items-center">
        <MemberCard
          accountEmail={user.email ?? null}
          showBackToProfiles={false}
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

        {!member.is_archived && hasPermission(permissions, "profile.update") && <EditProfileButton memberId={memberId} />}
      </div>
    </PageContainer>
  );
}
