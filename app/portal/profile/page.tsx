import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";
import ProfileSelector from "./ProfileSelector";
import { IdCardLanyard } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";


export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton kind="profiles" fields={6} metrics={0} columns={5} label="profile" />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  "use cache: private";
  cacheLife({ stale: 120 });
  cacheTag("portal:profile");
  const { user } = await requirePermission("profile.view");
  const supabase = await createClient();


  const { data: links, error } = await supabase
    .from("account_members")
    .select(`
    members!inner (
      id,
      first_name,
      last_name,
      profile_status,
      is_archived
    )
  `)
    .eq("user_id", user.id)
    .eq("relationship", "member")
    .eq("members.is_archived", false);

  if (error) {
    throw new Error(error.message);
  }

  const members =
    links
      ?.map((link) => {
        const relatedMembers = link.members as
          | {
            id: string;
            first_name: string;
            last_name: string;
            profile_status: string;
            is_archived: boolean;
          }
          | {
            id: string;
            first_name: string;
            last_name: string;
            profile_status: string;
            is_archived: boolean;
          }[]
          | null;

        if (!relatedMembers) return null;

        return Array.isArray(relatedMembers)
          ? relatedMembers[0] ?? null
          : relatedMembers;
      })
      .filter(
        (member): member is NonNullable<typeof member> =>
          Boolean(member),
      ) ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Personal"
        eyebrowIcon={<IdCardLanyard className="h-4 w-4" />}
        title="My Profiles"
        description="Manage the member profiles linked to your account."
      />

      <ProfileSelector members={members} />
    </PageContainer>
  );
}
