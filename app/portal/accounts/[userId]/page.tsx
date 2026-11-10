import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import {
  Mail,
  UserRoundCog,
  UsersRound,
  Unlink,
} from "lucide-react";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionSubmit } from "@/components/ui/table-action-submit";
import { EmptyState } from "@/components/ui/empty-state";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { disconnectMember } from "../../members/actions";
import { requireAccountTarget } from "../target-scope";
import { requireAccountsPermission } from "../access";

export default function AccountDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton kind="detail" fields={4} metrics={0} columns={5} label="accounts" />}>
      <AccountDetailsContent params={params} />
    </Suspense>
  );
}

async function AccountDetailsContent({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const access = await requireAccountsPermission("accounts.view");
  const canLinkMembers = hasPermission(
    access.permissions,
    "members.link_account",
  );

  const { userId } = await params;

  const admin = createAdminClient();
  await requireAccountTarget(access, admin, userId, "members");

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    redirect("/portal/accounts");
  }

  let linksQuery = admin
    .from("account_members")
    .select(`
      member_id,
      members!inner (
        id,
        first_name,
        middle_name,
        last_name,
        account_status,
        profile_status,
        church_branch_id
      )
    `)
    .eq("user_id", userId)
    .eq("relationship", "member");
  if (!access.isSystemAdmin) linksQuery = linksQuery.in("members.church_branch_id", access.branchIds);
  const { data: links, error: linksError } = await linksQuery;

  if (linksError) {
    throw new Error(linksError.message);
  }

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        backHref="/portal/accounts"
        backLabel="Back to Accounts"
        eyebrow="Account Management"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title="Account Details"
        description="Review this account and manage its linked member profiles."
      />

      <Card>
        <CardContent className="flex items-start gap-4 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FB] text-[#203264]">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account Email</p>
            <p className="mt-1 break-all font-medium text-[#203264]">{authData.user.email ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-[#5D94E8]" />
              <div>
                <h2 className="font-prompt text-lg font-semibold text-[#203264]">Linked Members</h2>
                <p className="text-xs text-slate-500">
                  {links?.length ?? 0} member{(links?.length ?? 0) === 1 ? "" : "s"} connected
                </p>
              </div>
            </div>
            {canLinkMembers && (
              <Button asChild size="sm">
                <Link href={`/portal/members/invite?email=${encodeURIComponent(authData.user.email ?? "")}&returnTo=${encodeURIComponent(`/portal/accounts/${userId}`)}`}>
                  <UsersRound className="h-4 w-4" />Link Members
                </Link>
              </Button>
            )}
          </div>

          {links?.length ? (
            <div className="divide-y divide-slate-100">
              {links.map((link) => {
                const member = Array.isArray(link.members) ? link.members[0] : link.members;
                if (!member) return null;
                const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
                const accountLabel = member.account_status === "connected" ? "Connected" : member.account_status === "invited" ? "Invited" : "No Account";
                return (
                  <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {hasPermission(access.permissions, "members.view") ? (
                        <Link href={`/portal/members/${member.id}`} className="break-words font-medium text-[#203264] hover:underline">{fullName}</Link>
                      ) : <p className="break-words font-medium text-[#203264]">{fullName}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge variant={member.account_status === "connected" ? "success" : member.account_status === "invited" ? "warning" : "muted"}>{accountLabel}</StatusBadge>
                        <StatusBadge variant={member.profile_status === "completed" ? "info" : "danger"}>
                          {member.profile_status === "completed" ? "Completed" : "Incomplete"}
                        </StatusBadge>
                      </div>
                    </div>
                    {canLinkMembers && (
                      <form action={async () => {
                        "use server";
                        await disconnectMember(member.id);
                      }} className="shrink-0">
                        <TableActionSubmit pendingLabel="Disconnecting..." icon={<Unlink />} variant="danger">Disconnect</TableActionSubmit>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState className="mt-4" icon={<UsersRound className="h-5 w-5" />} title="No linked members" description="This account has no connected member profiles." />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
