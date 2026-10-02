import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePortalTab } from "@/lib/require-portal-tab";
import ChangePasswordForm from "./ChangePasswordForm";

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  await requirePortalTab("account");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5D94E8]">
          Account
        </p>

        <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
          My Account
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Manage your login and account security.
        </p>
      </div>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Account Information
        </h2>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Email
          </p>

          <p className="mt-1 text-sm font-medium text-[#203264]">
            {user.email ?? "No email available"}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Security
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Change your password to keep your account secure.
        </p>

        <ChangePasswordForm email={user.email ?? ""} />
      </section>
    </main>
  );
}

function AccountSkeleton() {
  return (
    <main className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-20 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-64 rounded bg-slate-200" />
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="h-6 w-44 rounded bg-slate-200" />
        <div className="mt-6 h-4 w-20 rounded bg-slate-100" />
        <div className="mt-2 h-5 w-56 rounded bg-slate-200" />
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="h-6 w-28 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-100" />
        <div className="mt-6 h-11 w-40 rounded-xl bg-slate-200" />
      </div>
    </main>
  );
}