import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";

import { getAccountTargetScopes } from "../../accounts/target-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMembers } from "../actions";
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
  }>;
}) {
  const access = await requireMembersPermission(
    "members.link_account",
  );
  const { memberId, email } = await searchParams;

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

    members = data ?? [];
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

  async function action(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();

    const memberIds = formData
      .getAll("member_ids")
      .map((value) => String(value));

    await inviteMembers(memberIds, email, memberId);
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <Link
        href="/portal/members"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-[#203264]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Members
      </Link>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-[#5D94E8]">
          <Link2 className="h-4 w-4" />

          <p className="text-sm font-medium">
            Account Connection
          </p>
        </div>

        <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
          Connect Members to Account
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Connect one or more member records to an existing account, or enter
          a new email address to create and invite a new account.
        </p>
      </div>

      <div className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <InviteMembersForm
          key={`${memberId ?? ""}:${email ?? ""}`}
          members={members}
          existingEmails={existingEmails}
          defaultEmail={email ?? ""}
          defaultMemberId={memberId}
          action={action}
        />
      </div>
    </main>
  );
}
