import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function MemberDashboardPage() {
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

  const { data: link } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("member_id", selectedMemberId)
    .eq("relationship", "member")
    .maybeSingle();

  if (!link) {
    redirect("/member/select-profile");
  }

  const { data: member, error } = await supabase
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      birth_date,
      gender,
      phone_number,
      email,
      member_status,
      profile_status
    `)
    .eq("id", selectedMemberId)
    .single();

  if (error || !member) {
    redirect("/member/select-profile");
  }

  const fullName = [
    member.first_name,
    member.middle_name,
    member.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main>
      <h1 className="text-2xl font-bold">Welcome, {member.first_name}</h1>

      <div className="mt-6 rounded-xl border bg-background p-6">
        <h2 className="text-lg font-semibold">Member Information</h2>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">Full Name</dt>
            <dd>{fullName}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Birth Date</dt>
            <dd>{member.birth_date ?? "Not provided"}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Gender</dt>
            <dd>{member.gender ?? "Not provided"}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Phone Number</dt>
            <dd>{member.phone_number ?? "Not provided"}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd>{member.email ?? "Not provided"}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Member Status</dt>
            <dd>{member.member_status}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Profile Status</dt>
            <dd>{member.profile_status}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}