import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function MemberPortalLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/member/login");
  }

  return (
    <div className="min-h-screen bg-muted/30 md:grid md:grid-cols-[16rem_1fr]">
      <aside className="border-b bg-background p-4 md:min-h-screen md:border-b-0 md:border-r">
        <Link href="/member" className="text-lg font-semibold">
          UPC Connect
        </Link>

        <p className="mt-1 text-sm text-muted-foreground">
          Member Portal
        </p>

        <nav className="mt-6 space-y-1">
          <Link
            href="/member"
            className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            Dashboard
          </Link>

          <Link
            href="/member/profiles"
            className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            Profiles
          </Link>
        </nav>

        <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          <p className="truncate">{user.email}</p>
        </div>
      </aside>

      <main className="p-6 md:p-8">{children}</main>
    </div>
  );
}