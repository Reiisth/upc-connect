import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CompleteProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
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
        account_status
      )
    `)
    .eq("user_id", user.id)
    .eq("relationship", "member");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main>
      <h1>Choose a member profile</h1>

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

        const isCompleted =
          member.profile_status === "completed";

        return (
          <div key={member.id}>
            {isCompleted ? (
              <p>
                {fullName} — Completed
              </p>
            ) : (
              <Link href={`/member/complete-profile/${member.id}`}>
                {fullName}
              </Link>
            )}
          </div>
        );
      })}
    </main>
  );
}