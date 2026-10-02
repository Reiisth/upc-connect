import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowLeft,
  Mail,
  UserRoundCog,
  UsersRound,
  Unlink,
} from "lucide-react";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { disconnectMember } from "../../members/actions";

export default function AccountDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense fallback={<AccountDetailsLoading />}>
      <AccountDetailsContent params={params} />
    </Suspense>
  );
}

async function AccountDetailsContent({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePortalTab("accounts");

  const { userId } = await params;

  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    redirect("/portal/accounts");
  }

  const { data: links, error: linksError } = await admin
    .from("account_members")
    .select(`
      member_id,
      members (
        id,
        first_name,
        middle_name,
        last_name,
        account_status,
        profile_status
      )
    `)
    .eq("user_id", userId)
    .eq("relationship", "member");

  if (linksError) {
    throw new Error(linksError.message);
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <Link
          href="/portal/accounts"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-[#203264]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </Link>

        <div className="mt-5 flex items-center gap-2 text-[#5D94E8]">
          <UserRoundCog className="h-4 w-4" />

          <p className="text-sm font-medium">
            Account Management
          </p>
        </div>

        <h1 className="mt-1 font-heading text-2xl font-semibold text-[#203264] sm:text-3xl">
          Account Details
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Review this account and manage its linked member profiles.
        </p>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]">
            <Mail className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Account Email
            </p>

            <p className="mt-1 break-all font-medium text-[#203264]">
              {authData.user.email ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-[#5D94E8]" />

            <div>
              <h2 className="font-heading text-lg font-semibold text-[#203264]">
                Linked Members
              </h2>

              <p className="text-xs text-muted-foreground">
                {links?.length ?? 0} member
                {(links?.length ?? 0) === 1 ? "" : "s"} connected
              </p>
            </div>
          </div>

          <Link
            href={`/portal/members/invite?email=${encodeURIComponent(
              authData.user.email ?? "",
            )}`}
            className="rounded-xl bg-[#203264] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2C447D]"
          >
            Link Members
          </Link>
        </div>

        {links?.length ? (
          <div className="divide-y">
            {links.map((link) => {
              const member = link.members?.[0];

              if (!member) return null;

              const fullName = [
                member.first_name,
                member.middle_name,
                member.last_name,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <p className="font-medium text-[#203264]">
                      {fullName}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge
                        type="account"
                        value={member.account_status}
                      />

                      <StatusBadge
                        type="profile"
                        value={member.profile_status}
                      />
                    </div>
                  </div>

                  <form
                    action={async () => {
                      "use server";
                      await disconnectMember(member.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-muted-foreground/50" />

            <p className="mt-3 text-sm font-medium text-[#203264]">
              No linked members
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({
  type,
  value,
}: {
  type: "account" | "profile";
  value: string;
}) {
  let styles = "bg-gray-100 text-gray-700";
  let label = value.replaceAll("_", " ");

  if (type === "account") {
    if (value === "connected") {
      styles = "bg-green-100 text-green-700";
      label = "Connected";
    } else if (value === "invited") {
      styles = "bg-amber-100 text-amber-700";
      label = "Invited";
    } else if (value === "no_account") {
      styles = "bg-slate-100 text-slate-600";
      label = "No Account";
    }
  }

  if (type === "profile") {
    if (value === "completed") {
      styles = "bg-blue-100 text-blue-700";
      label = "Completed";
    } else if (value === "incomplete") {
      styles = "bg-rose-100 text-rose-700";
      label = "Incomplete";
    }
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function AccountDetailsLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
    </div>
  );
}