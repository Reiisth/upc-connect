import { Suspense } from "react";
import ProfileSkeleton from "./ProfileSkeleton";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createClient } from "@/lib/supabase/server";
import ProfileSelector from "./ProfileSelector";

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
      ?.map((link) => link.members?.[0])
      .filter(
        (member): member is NonNullable<typeof member> =>
          Boolean(member),
      ) ?? [];

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5D94E8]">
          Member Profile
        </p>

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