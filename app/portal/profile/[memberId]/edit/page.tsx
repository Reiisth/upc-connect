import { Suspense } from "react";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";

import { requireOwnedProfile } from "../../access";
import { saveMemberProfile } from "../../actions";
import { isProfileDefinition } from "@/lib/member-field-policy";
import { getMemberFieldDefinitions } from "@/lib/member-fields";

import MemberProfileForm from "../../../components/MemberProfileForm";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export default function EditMemberProfilePage(
  props: PageProps,
) {
  return (
    <Suspense fallback={<EditProfileLoading />}>
      <EditMemberProfileContent {...props} />
    </Suspense>
  );
}

async function EditMemberProfileContent({
  params,
}: PageProps) {
  const { memberId } = await params;

  const { user, supabase } = await requireOwnedProfile(memberId, "profile.update");

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    redirect("/portal/profile");
  }

  if (member.is_archived) redirect("/access-denied");

  const { data: branches } = await supabase
    .from("church_branches")
    .select("id, name")
    .order("name");

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  const fieldDefinitions = (await getMemberFieldDefinitions()).filter(isProfileDefinition);

  const updateProfile = saveMemberProfile.bind(null, memberId);

  const { data: customFieldValues, error: customValuesError } =
    await supabase
      .from("member_custom_field_values")
      .select(`
      field_definition_id,
      value
    `)
      .eq("member_id", memberId);

  if (customValuesError) {
    throw new Error(customValuesError.message);
  }

  const customFieldValueMap = Object.fromEntries(
    (customFieldValues ?? []).map((item) => [
      item.field_definition_id,
      item.value,
    ]),
  );

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        backHref={`/portal/profile/${memberId}`}
        backLabel="Back to Profile"
        eyebrow="Profile Management"
        eyebrowIcon={<UserRound className="h-4 w-4" />}
        title="Edit Profile"
        description={`Update the profile information for ${member.first_name} ${member.last_name}.`}
      />

      <MemberProfileForm
        member={member}
        accountEmail={user.email ?? ""}
        branches={branches ?? []}
        departments={departments ?? []}
        fieldDefinitions={fieldDefinitions}
        customFieldValues={customFieldValueMap}
        action={updateProfile}
      />
    </PageContainer>
  );
}

function EditProfileLoading() {
  return (
    <PageContainer className="max-w-5xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="space-y-5">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </PageContainer>
  );
}