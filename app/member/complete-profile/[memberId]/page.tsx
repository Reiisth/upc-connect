import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: link } = await supabase
    .from("account_members")
    .select("member_id")
    .eq("user_id", user.id)
    .eq("member_id", memberId)
    .eq("relationship", "member")
    .single();

  if (!link) {
    redirect("/auth/error?error=Member profile not linked to this account");
  }

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (!member) {
    redirect("/auth/error?error=Member profile not found");
  }

  async function updateProfile(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const { data: link } = await supabase
      .from("account_members")
      .select("member_id")
      .eq("user_id", user.id)
      .eq("member_id", memberId)
      .eq("relationship", "member")
      .single();

    if (!link) {
      redirect("/auth/error?error=Member profile not linked to this account");
    }

    const { error } = await supabase
      .from("members")
      .update({
        middle_name: String(formData.get("middle_name") ?? "").trim() || null,
        birth_date: String(formData.get("birth_date") ?? "") || null,
        gender: String(formData.get("gender") ?? "") || null,
        phone_number:
          String(formData.get("phone_number") ?? "").trim() || null,
        email: String(formData.get("email") ?? "").trim() || null,
        account_status: "connected",
        profile_status: "completed",
        profile_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      throw new Error(error.message);
    }

    redirect("/member/complete-profile");
  }

  return (
    <main>
      <h1>
        Complete profile for {member.first_name} {member.last_name}
      </h1>

      <form action={updateProfile}>
        <div>
          <label htmlFor="middle_name">Middle name</label>
          <input
            id="middle_name"
            name="middle_name"
            defaultValue={member.middle_name ?? ""}
          />
        </div>

        <div>
          <label htmlFor="birth_date">Birth date</label>
          <input
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={member.birth_date ?? ""}
          />
        </div>

        <div>
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            defaultValue={member.gender ?? ""}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div>
          <label htmlFor="phone_number">Phone number</label>
          <input
            id="phone_number"
            name="phone_number"
            defaultValue={member.phone_number ?? ""}
          />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={member.email ?? user.email ?? ""}
          />
        </div>

        <button type="submit">Save Profile</button>
      </form>
    </main>
  );
}