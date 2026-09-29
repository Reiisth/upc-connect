import { Suspense } from "react";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";
import MembersTable from "./MembersTable";

export default function PortalMembersPage() {
  return (
    <Suspense fallback={<MembersLoading />}>
      <MembersPageContent />
    </Suspense>
  );
}

async function MembersPageContent() {
  await requirePortalTab("members");

  const admin = createAdminClient();

  const { data: members, error } = await admin
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      email,
      account_status,
      profile_status,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const totalMembers = members?.length ?? 0;

  const connectedMembers =
    members?.filter(
      (member) => member.account_status === "connected",
    ).length ?? 0;

  const incompleteProfiles =
    members?.filter(
      (member) => member.profile_status !== "completed",
    ).length ?? 0;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#5D94E8]">
            <UsersRound className="h-4 w-4" />

            <p className="text-sm font-medium">
              Member Management
            </p>
          </div>

          <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
            Members
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage church member records, account connections,
            and profile completion.
          </p>
        </div>

        <Link
          href="/portal/members/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#203264] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2C447D] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Member
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Total Members
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-[#203264]">
            {totalMembers}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Connected
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-green-700">
            {connectedMembers}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Incomplete
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-amber-700">
            {incompleteProfiles}
          </p>
        </div>
      </div>

      <MembersTable members={members ?? []} />
    </main>
  );
}

function MembersLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
    </div>
  );
}