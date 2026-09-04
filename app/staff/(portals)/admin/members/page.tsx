import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { disconnectMember } from "./actions";

export default async function AdminMembersPage() {
  await requireRole("system_admin");

  const admin = createAdminClient();

  const { data: members, error } = await admin
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      email,
      account_status,
      profile_status,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main>
      <div>
        <h1>Members</h1>

        <Link href="/staff/admin/members/new">
          Create Member
        </Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Account Status</th>
            <th>Profile Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {members?.map((member) => {
            const fullName = [
              member.first_name,
              member.middle_name,
              member.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <tr key={member.id}>
                <td>{fullName}</td>

                <td>{member.email ?? "—"}</td>

                <td>{member.account_status}</td>

                <td>{member.profile_status}</td>

                <td>
                  {member.account_status === "no_account" ? (
                    <Link
                      href={`/staff/admin/members/invite?memberId=${member.id}`}
                    >
                      Connect Email
                    </Link>
                  ) : (
                    <form
                      action={async () => {
                        "use server";
                        await disconnectMember(member.id);
                      }}
                    >
                      <button type="submit">Disconnect</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}