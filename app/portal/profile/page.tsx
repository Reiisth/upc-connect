import { Suspense } from "react";
import ProfileSkeleton from "./ProfileSkeleton";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createClient } from "@/lib/supabase/server";
import ProfileSelector from "./ProfileSelector";
import { IdCardLanyard } from "lucide-react";


export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  await requirePortalTab("profile");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

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
    <main className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#5D94E8]">
          <IdCardLanyard className="h-4 w-4" />
          Member Profile
        </div>

        <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
          My Profile
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Manage your member information.
        </p>
      </div>

      <ProfileSelector members={members} />
    </main>
  );
}