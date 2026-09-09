import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SwitchCamera, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { logoutMember } from "./actions";
import MemberNavigation from "./components/MemberNavigation";
import { cookies } from "next/headers";
import { MemberProvider } from "./components/MemberProvider";


export default function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MemberPortalLoading />}>
      <MemberPortalShell>{children}</MemberPortalShell>
    </Suspense>
  );
}

async function MemberPortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/member/login");
  }

  const cookieStore = await cookies();
  const selectedMemberId = cookieStore.get("selected_member_id")?.value;

  if (!selectedMemberId) {
    redirect("/member/select-profile");
  }

  const { data: memberLink, error: memberLinkError } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("member_id", selectedMemberId)
    .eq("relationship", "member")
    .maybeSingle();

  if (memberLinkError) {
    throw new Error(memberLinkError.message);
  }

  if (!memberLink) {
    redirect("/member/select-profile");
  }


  const { data: member, error: memberError } = await supabase
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      nickname,
      birth_date,
      gender,
      phone_number,
      email,
      zone,
      civil_status,
      street_address,
      barangay,
      city,
      province,
      country,
      position,
      church_branch_id,
      department_id,
      photo_url,
      department:departments (
        name
      ),
      church_branch:church_branches (
        name
      )
    `)
    .eq("id", selectedMemberId)
    .single();

  if (memberError) {
    throw new Error(memberError.message);
  }

  return (
    <div className="min-h-screen bg-[#EEF3FB] md:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-white md:sticky md:top-0 md:flex">
        <div className="flex items-center gap-3 border-b px-5 py-5">
          <Image
            src="/upc-logo.png"
            alt="UPC Connect"
            width={44}
            height={44}
            priority
          />

          <div>
            <p className="font-heading text-lg font-semibold text-[#203264]">
              UPC CONNECT
            </p>

            <p className="text-xs text-muted-foreground">
              Member Portal
            </p>
          </div>
        </div>

        <MemberNavigation variant="desktop" />

        <div className="border-t p-4">
          <Link
            href="/member/select-profile"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[#203264] transition hover:bg-[#EEF3FB]"
          >
            <SwitchCamera className="h-5 w-5" />
            Switch Profile
          </Link>

          <form action={logoutMember}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* PAGE CONTENT */}
      <MemberProvider key={member.id} member={member}>
        {/* MOBILE HEADER */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Image
              src="/upc-logo.png"
              alt="UPC Connect"
              width={36}
              height={36}
            />

            <div>
              <p className="font-heading text-sm font-semibold text-[#203264]">
                UPC CONNECT
              </p>
              <p className="text-[10px] text-muted-foreground">
                Member Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/member/select-profile"
              aria-label="Switch profile"
              title="Switch profile"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#203264] transition hover:bg-[#EEF3FB]"
            >
              <SwitchCamera className="h-5 w-5" />
            </Link>

            <form action={logoutMember}>
              <button
                type="submit"
                aria-label="Logout"
                title="Logout"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </MemberProvider>

      {/* MOBILE NAV */}
      <MemberNavigation variant="mobile" />
    </div>
  );
}

function MemberPortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EEF3FB]">
      <p className="text-sm text-muted-foreground">
        Loading member portal...
      </p>
    </div>
  );
}