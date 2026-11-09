import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import MemberAccountsTable from "./MemberAccountsTable";
import {
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import AccountsTabs from "../AccountsTabs";
import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUsersByIds } from "../auth-users";
import { hasPermission } from "@/lib/permissions";
import { getAccountTargetScopes } from "../target-scope";
import { requireAccountsPermission } from "../access";

export default function MemberAccountsPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="accounts members" />}>
      <MemberAccountsContent />
    </Suspense>
  );
}

async function MemberAccountsContent() {
  const access = await requireAccountsPermission("accounts.view");
  const admin = createAdminClient();
  const targets = await getAccountTargetScopes(access, admin);
  const visibleIds = [...targets.values()].filter((target) => target.canViewMembers).map((target) => target.userId);

  let linksQuery = admin
    .from("account_members")
    .select(`
      user_id,
      member_id,
      members!inner (
        id,
        first_name,
        middle_name,
        last_name,
        church_branch_id
      )
    `)
    .eq("relationship", "member").in("user_id", visibleIds);
  if (!access.isSystemAdmin) linksQuery = linksQuery.in("members.church_branch_id", access.branchIds);
  const { data: links, error } = await linksQuery;

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

  const accountIds = [...accountMap.keys()];
  const [authUsers, profileResult] = await Promise.all([
    getAuthUsersByIds(admin, accountIds),
    accountIds.length
      ? admin.from("profiles").select("id, archived_at").in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  const profiles = new Map(
    (profileResult.data ?? []).map((profile) => [profile.id, profile]),
  );

  const accounts = [...accountMap.values()].map((account) => {
    const user = authUsers.get(account.userId);
    const profile = profiles.get(account.userId);
    if (!user || !profile) throw new Error("Unable to load account.");
    return {
      userId: account.userId,
      email: user.email ?? "—",
      members: account.members,
      archivedAt: profile.archived_at,
      canChangeAccount: targets.get(account.userId)?.canChangeAccount ?? false,
    };
  });

  const totalAccounts = accounts.length;

  const totalLinkedMembers = accounts.reduce(
    (total, account) => total + account.members.length,
    0,
  );
  const canArchive = hasPermission(
    access.permissions,
    "accounts.archive",
  );
  const canRestore = hasPermission(
    access.permissions,
    "accounts.restore",
  );
  const canLinkAccount = hasPermission(
    access.permissions,
    "members.link_account",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account Management"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title="Member Accounts"
        description="View member accounts, review their linked profiles, and connect additional members to existing accounts."
      />

      <AccountsTabs permissions={access.permissions} />

      {/* SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <UserRoundCog className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Member Accounts
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264]">
              {totalAccounts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <UsersRound className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Linked Members
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264]">
              {totalLinkedMembers}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TABLE */}
      <MemberAccountsTable
        accounts={accounts}
        canArchive={canArchive}
        canRestore={canRestore}
        canLinkAccount={canLinkAccount}
      />
    </PageContainer>
  );
}
