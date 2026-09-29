import { Suspense } from "react";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { getMemberFieldDefinitions } from "@/lib/member-fields";
import { createClient } from "@/lib/supabase/server";
import ProfileSelector from "./ProfileSelector";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
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
    members (
      id,
      first_name,
      last_name,
      profile_status
    )
  `)
    .eq("user_id", user.id)
    .eq("relationship", "member");

  if (error) {
    throw new Error(error.message);
  }

  const members =
    links
      ?.map((link) => link.members)
      .filter((member): member is NonNullable<typeof member> => Boolean(member)) ??
    [];

  const fieldDefinitions = await getMemberFieldDefinitions();

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5D94E8]">
          Member Profile
        </p>

        <h1 className="mt-1 font-heading text-3xl font-semibold text-[#203264]">
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

function ProfileLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
    </div>
  );
}