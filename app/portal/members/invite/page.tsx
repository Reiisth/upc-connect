import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMembers } from "../actions";
import InviteMembersForm from "./InviteMembersForm";
import { requirePortalTab } from "@/lib/require-portal-tab";

export default async function InviteMembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    memberId?: string;
    email?: string;
  }>;
}) {
  await requirePortalTab("members");
  const { memberId, email } = await searchParams;

  const admin = createAdminClient();

  const { data: members, error: membersError } = await admin
    .from("members")
    .select(`
    id,
    first_name,
    middle_name,
    last_name,
    account_status
  `)
    .eq("account_status", "no_account")
    .order("last_name");

  if (membersError) {
    throw new Error(membersError.message);
  }

  const existingEmails: string[] = [];

  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      if (user.email) {
        existingEmails.push(user.email);
      }
    }

    if (data.users.length < 1000) {
      break;
    }

    page++;
  }

  existingEmails.sort((a, b) => a.localeCompare(b));

  async function action(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();

    const memberIds = formData
      .getAll("member_ids")
      .map((value) => String(value));

    await inviteMembers(memberIds, email);
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
          members={members ?? []}
          existingEmails={existingEmails}
          defaultEmail={email ?? ""}
          defaultMemberId={memberId}
          action={action}
        />
      </div>
    </main>
  );
}