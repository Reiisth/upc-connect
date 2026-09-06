import Image from "next/image";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { selectMemberProfile } from "./actions";

export default async function SelectProfilePage() {
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

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

            return (
              <form
                key={member.id}
                action={async () => {
                  "use server";
                  await selectMemberProfile(member.id);
                }}
              >
                <button
                  type="submit"
                  className="group w-full rounded-3xl border bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-[#5D94E8]/40 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#5D94E8]/15"
                >
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-gradient font-heading text-2xl font-semibold text-white shadow-md transition group-hover:scale-105">
                    {initials}
                  </div>

                  <h2 className="mt-5 font-heading text-lg font-semibold text-[#203264]">
                    {fullName}
                  </h2>

                  <div className="mt-3">
                    <span
                      className={
                        isComplete
                          ? "inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                          : "inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {isComplete ? "Profile ready" : "Profile incomplete"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground">
                    Tap to continue
                  </p>
                </button>
              </form>
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