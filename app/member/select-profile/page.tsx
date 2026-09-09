import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { selectMemberProfile } from "./actions";

export default async function SelectProfilePage() {
  return (
    <Suspense fallback={<SelectProfileLoading />}>
      <SelectProfileContent />
    </Suspense>
  );
}

async function SelectProfileContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/member/login");
  }

  const { data: links, error } = await supabase
    .from("account_members")
    .select(`
      member_id,
      members (
        id,
        first_name,
        middle_name,
        last_name,
        profile_status
      )
    `)
    .eq("user_id", user.id)
    .eq("relationship", "member");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB] px-5 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <Image
              src="/upc-logo.png"
              alt="UPC Connect"
              width={52}
              height={52}
              priority
            />

            <div>
              <p className="font-heading text-xl font-semibold text-[#203264]">
                UPC CONNECT
              </p>
              <p className="text-sm text-muted-foreground">
                Member Portal
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm font-medium text-[#5D94E8]">
            Choose a profile
          </p>

          <h1 className="mt-2 font-body text-3xl font-semibold text-[#203264] sm:text-4xl">
            Who&apos;s using UPC Connect?
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Select the member profile you want to access.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {links?.map((link) => {
            const member = link.members;


            if (!member) return null;

            const fullName = [
              member.first_name,
              member.middle_name,
              member.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            const initials = [
              member.first_name?.[0],
              member.last_name?.[0],
            ]
              .filter(Boolean)
              .join("")
              .toUpperCase();

            const isComplete = member.profile_status === "completed";

            return isComplete ? (
              <form
                key={member.id}
                action={async () => {
                  "use server";
                  await selectMemberProfile(member.id);
                }}
                className="h-full"
              >
                <button
                  type="submit"
                  className="h-full min-h-[150px] w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:min-h-[190px] sm:p-5"
                >
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-lg font-semibold text-white sm:h-20 sm:w-20 sm:text-2xl">
                      {initials}
                    </div>

                    <h2 className="mt-3 line-clamp-1 text-sm font-semibold text-[#203264] sm:text-base">
                      {member.first_name} {member.last_name}
                    </h2>

                    <p className="mt-1 text-xs text-green-600 sm:text-sm">
                      Profile ready
                    </p>
                  </div>
                </button>
              </form>
            ) : (
              <Link
                key={member.id}
                href={`/member/complete-profile/${member.id}`}
                className="h-full"
              >
                <div className="h-full min-h-[150px] w-full rounded-2xl border border-amber-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:min-h-[190px] sm:p-5">
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-lg font-semibold text-amber-700 sm:h-20 sm:w-20 sm:text-2xl">
                      {initials}
                    </div>

                    <h2 className="mt-3 line-clamp-1 text-sm font-semibold text-[#203264] sm:text-base">
                      {member.first_name} {member.last_name}
                    </h2>

                    <p className="mt-1 text-xs font-medium text-amber-600 sm:text-sm">
                      Complete profile
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!links?.length && (
          <div className="mt-10 rounded-3xl border bg-white p-8 text-center">
            <h2 className="font-heading text-xl font-semibold text-[#203264]">
              No profiles found
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              There are no member profiles connected to this account yet.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Signed in as {user.email}
        </p>
      </div>
    </main>
  );
}

function SelectProfileLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF3FB]">
      <p className="text-sm text-muted-foreground">
        Loading profiles...
      </p>
    </main>
  );
}