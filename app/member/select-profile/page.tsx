import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold">Who&apos;s using UPC Connect?</h1>
          <p className="mt-2 text-muted-foreground">
            Choose a member profile to continue.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="group w-full rounded-xl border bg-background p-6 text-center transition hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold transition group-hover:scale-105">
                    {initials}
                  </div>

                  <h2 className="mt-4 font-semibold">{fullName}</h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {member.profile_status === "completed"
                      ? "Profile ready"
                      : "Profile incomplete"}
                  </p>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </main>
  );
}