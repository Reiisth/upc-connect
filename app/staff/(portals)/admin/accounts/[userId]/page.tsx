import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { disconnectMember } from "../../members/actions";

export default async function AccountDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireRole("system_admin");

  const { userId } = await params;
  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    redirect("/staff/admin/accounts");
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
    <main>
      <h1>Account Details</h1>

      <p>
        <strong>Email:</strong> {authData.user.email ?? "—"}
      </p>

      <h2>Linked Members</h2>

      {links?.length ? (
        <ul>
          {links.map((link) => {
            const member = link.members;

            if (!member) return null;

            const fullName = [
              member.first_name,
              member.middle_name,
              member.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={member.id}>
                <strong>{fullName}</strong>
                <div>Account status: {member.account_status}</div>
                <div>Profile status: {member.profile_status}</div>
                <form
                  action={async () => {
                    "use server";
                    await disconnectMember(member.id);
                  }}
                >
                  <button type="submit">Disconnect</button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No members are linked to this account.</p>
      )}
    </main>
  );
}