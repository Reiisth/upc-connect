import Link from "next/link";
import { requirePortalTab } from "@/lib/require-portal-tab";
import {
  UserRoundCog,
  UsersRound,
  ExternalLink,
  UserPlus,
} from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAccountsPage() {
  const admin = createAdminClient();
  await requirePortalTab("accounts");

  const { data: links, error } = await admin
    .from("account_members")
    .select(`
      user_id,
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
    const member = link.members;

    if (!member) continue;

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

    accounts.push({
      userId: account.userId,
      email: data.user.email ?? "—",
      members: account.members,
    });
  }

  const totalAccounts = accounts.length;

  const totalLinkedMembers = accounts.reduce(
    (total, account) => total + account.members.length,
    0,
  );

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 text-[#5D94E8]">
          <UserRoundCog className="h-4 w-4" />

          <p className="text-sm font-medium">
            Account Management
          </p>
        </div>

        <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
          Member Accounts
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          View member accounts, review their linked profiles, and connect
          additional members to existing accounts.
        </p>
      </div>

      {/* SUMMARY */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserRoundCog className="h-4 w-4" />
            <p className="text-xs font-medium">
              Member Accounts
            </p>
          </div>

          <p className="mt-2 font-heading text-2xl font-semibold text-[#203264]">
            {totalAccounts}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            <p className="text-xs font-medium">
              Linked Members
            </p>
          </div>

          <p className="mt-2 font-heading text-2xl font-semibold text-[#203264]">
            {totalLinkedMembers}
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-4">
                Email
              </th>

              <th className="px-5 py-4">
                Linked Members
              </th>

              <th className="px-5 py-4">
                Count
              </th>

              <th className="px-5 py-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {accounts.map((account) => (
              <tr
                key={account.userId}
                className="transition hover:bg-[#F8FAFD]"
              >
                <td className="px-5 py-4">
                  <Link
                    href={`/staff/admin/accounts/${account.userId}`}
                    className="font-medium text-[#203264] hover:text-[#5D94E8]"
                  >
                    {account.email}
                  </Link>
                </td>

                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {account.members.map((member) => (
                      <span
                        key={member}
                        className="rounded-full bg-[#EEF3FB] px-2.5 py-1 text-xs font-medium text-[#203264]"
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {account.members.length}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/portal/accounts/${account.userId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-[#203264] transition hover:bg-[#EEF3FB]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Link>

                    <Link
                      href={`/portal/members/invite?email=${encodeURIComponent(
                        account.email,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#203264] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2C447D]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Link Members
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {!accounts.length && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-sm text-muted-foreground"
                >
                  No member accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}