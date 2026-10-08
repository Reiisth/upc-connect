import { requirePortalTab } from "@/lib/require-portal-tab";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MemberAccountsTable from "./MemberAccountsTable";
import {
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import AccountsTabs from "../AccountsTabs";
import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

export default function MemberAccountsPage() {
  return (
    <Suspense fallback={<MemberAccountsSkeleton />}>
      <MemberAccountsContent />
    </Suspense>
  );
}

async function MemberAccountsContent() {
  const admin = createAdminClient();
  await requirePortalTab("accounts");

  const { data: links, error } = await admin
    .from("account_members")
    .select(`
      user_id,
      member_id,
      members (
        id,
        first_name,
        middle_name,
        last_name
      )
    `)
    .eq("relationship", "member");

  if (error) {
    throw new Error(error.message);
  }

  const accountMap = new Map<
    string,
    {
      userId: string;
      members: string[];
    }
  >();

  for (const link of links ?? []) {
    const member = Array.isArray(link.members)
      ? link.members[0]
      : link.members;

    if (!member) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[Member Accounts] Skipping an account_members row without a related member record.",
          {
            userId: link.user_id,
            memberId: link.member_id,
          },
        );
      }

      continue;
    }

    const fullName = [
      member.first_name,
      member.middle_name,
      member.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const existing = accountMap.get(link.user_id);

    if (existing) {
      existing.members.push(fullName);
    } else {
      accountMap.set(link.user_id, {
        userId: link.user_id,
        members: [fullName],
      });
    }
  }

  const accounts = [];

  for (const account of accountMap.values()) {
    const { data, error } = await admin.auth.admin.getUserById(
      account.userId,
    );

    if (error) {
      throw new Error(error.message);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("archived_at")
      .eq("id", account.userId)
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    accounts.push({
      userId: account.userId,
      email: data.user.email ?? "—",
      members: account.members,
      archivedAt: profile.archived_at,
    });
  }

  const totalAccounts = accounts.length;

  const totalLinkedMembers = accounts.reduce(
    (total, account) => total + account.members.length,
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account Management"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title="Member Accounts"
        description="View member accounts, review their linked profiles, and connect additional members to existing accounts."
      />

      <AccountsTabs />

      {/* SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <UserRoundCog className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Member Accounts
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264] dark:text-slate-100">
              {totalAccounts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <UsersRound className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Linked Members
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264] dark:text-slate-100">
              {totalLinkedMembers}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TABLE */}
      <MemberAccountsTable accounts={accounts} />
    </PageContainer>
  );
}

function MemberAccountsSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-11 w-72 rounded-xl" />

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-[760px]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-4 items-center gap-4 px-4 py-4"
              >
                <Skeleton className="h-4 w-44" />

                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                <Skeleton className="h-6 w-8 rounded-full" />

                <div className="flex justify-end gap-3">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
