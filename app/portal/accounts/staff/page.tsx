import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";

import AccountsTabs from "../AccountsTabs";
import { UserRoundCog } from "lucide-react";

export default function StaffAccountsPage() {
  return (
    <Suspense fallback={<StaffAccountsSkeleton />}>
      <StaffAccountsContent />
    </Suspense>
  );
}

async function StaffAccountsContent() {
  await requirePortalTab("accounts");

  const admin = createAdminClient();

  const { data: staffRoleLinks, error: roleError } = await admin
    .from("user_roles")
    .select(`
      user_id,
      roles!inner (
        name
      )
    `)
    .neq("roles.name", "member");

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roleMap = new Map<string, string[]>();

  for (const link of staffRoleLinks ?? []) {
    const roleName = link.roles?.[0]?.name;

    if (!roleName) continue;

    const existing = roleMap.get(link.user_id) ?? [];

    if (!existing.includes(roleName)) {
      existing.push(roleName);
    }

    roleMap.set(link.user_id, existing);
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.listUsers();

  if (authError) {
    throw new Error(authError.message);
  }

  const staffAccounts = authData.users
    .filter((user) => roleMap.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email ?? "No email",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      roles: roleMap.get(user.id) ?? [],
    }));

  return (
    <main className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#5D94E8]">
          <UserRoundCog className="h-4 w-4" />

          <p className="text-sm font-medium">
            Account Management
          </p>
        </div>

        <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
          Staff Accounts
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Manage login accounts assigned to staff roles.
        </p>
      </div>

      <AccountsTabs />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">
                  Email
                </th>

                <th className="px-5 py-4 font-medium">
                  Roles
                </th>

                <th className="px-5 py-4 font-medium">
                  Last Sign In
                </th>

                <th className="px-5 py-4 font-medium">
                  Created
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {staffAccounts.map((account) => (
                <tr
                  key={account.id}
                  className="transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4 font-medium text-[#203264]">
                    {account.email}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {account.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-[#EEF3FB] px-2.5 py-1 text-xs font-medium text-[#203264]"
                        >
                          {formatRole(role)}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(account.lastSignInAt)}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(account.createdAt)}
                  </td>
                </tr>
              ))}

              {staffAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    No staff accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatRole(role: string) {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StaffAccountsSkeleton() {
  return (
    <main className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-20 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-44 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-200" />
      </div>

      <div className="h-11 w-72 rounded-xl bg-slate-200" />

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 gap-4 border-b px-5 py-5 last:border-b-0"
          >
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-100" />
            <div className="h-4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}