import { Link2 } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { getAccountTargetScopes } from "../../accounts/target-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectMembersToAccount } from "../actions";
import { unstable_rethrow } from "next/navigation";
import { MemberConnectionValidationError, type MemberConnectionResult } from "@/lib/member-connection";
import { accountConnectionNavigation } from "@/lib/account-connection-navigation";
import { requireMembersPermission } from "../access";
import { getAccessibleActiveBranches } from "../../services/access";
import InviteMembersForm from "./InviteMembersForm";

type InviteMember = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  account_status: string;
};

export default async function InviteMembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    memberId?: string;
    email?: string;
    returnTo?: string;
  }>;
}) {
  const access = await requireMembersPermission(
    "members.link_account",
  );
  const { memberId, email, returnTo } = await searchParams;
  const navigation = accountConnectionNavigation(returnTo);

  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const branchIds = branches.map((branch) => branch.id);

  let members: InviteMember[] = [];

  if (branchIds.length > 0) {
    const { data, error } = await admin
      .from("members")
      .select(`
    id,
    first_name,
    middle_name,
    last_name,
    account_status
  `)
      .in("church_branch_id", branchIds)
      .eq("account_status", "no_account")
      .eq("is_archived", false)
      .order("last_name");

    if (error) {
      throw new Error(error.message);
    }

    const candidates = data ?? [];
    if (candidates.length) {
      const { data: links, error: linksError } = await admin.from("account_members")
        .select("member_id").in("member_id", candidates.map(member => member.id)).eq("relationship", "member");
      if (linksError) throw new Error("Unable to load available member profiles.");
      const connectedIds = new Set((links ?? []).map(link => link.member_id));
      members = candidates.filter(member => !connectedIds.has(member.id));
    }
  }

  const existingEmails: string[] = [];

  const targets = await getAccountTargetScopes(access, admin);
  for (const target of targets.values()) {
    if (!target.canViewMembers && !target.canViewStaff) continue;
    const { data, error } = await admin.auth.admin.getUserById(target.userId);
    if (error) throw new Error("Unable to load accessible accounts.");
    if (data.user?.email) existingEmails.push(data.user.email);
  }

  existingEmails.sort((a, b) => a.localeCompare(b));

  async function action(formData: FormData): Promise<MemberConnectionResult> {
    "use server";

    const email = String(formData.get("email") ?? "").trim();

    const memberIds = formData
      .getAll("member_ids")
      .map((value) => String(value));

    try {
      const redirectTo = await connectMembersToAccount(memberIds, email, memberId);
      return { redirectTo: returnTo ? navigation.backHref : redirectTo };
    } catch (error) {
      unstable_rethrow(error);
      return { error: error instanceof MemberConnectionValidationError ? error.message : "Unable to connect these members. Please try again." };
    }
  }

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader {...navigation}
        eyebrow="Account Connection" eyebrowIcon={<Link2 className="h-4 w-4" />}
        title="Connect Members to Account"
        description="Connect member profiles to an existing account, or invite a new account by email." />
        <InviteMembersForm
          key={`${memberId ?? ""}:${email ?? ""}`}
          members={members}
          existingEmails={existingEmails}
          defaultEmail={email ?? ""}
          defaultMemberId={memberId}
          action={action}
        />
    </PageContainer>
  );
}
