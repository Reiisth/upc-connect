import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminAccountsPage() {

  const admin = createAdminClient();

  const { data: links, error } = await admin
    .from("account_members")
    .select(`
      user_id,
      members (
        id,
        first_name,
        middle_name,
        last_name
      )
    `)
    .eq("relationship", "member");

  if (error) {
    throw new Error(error.message);
  }

  const accountMap = new Map<
    string,
    {
      userId: string;
      members: string[];
    }
  >();

  for (const link of links ?? []) {
    const member = link.members;

    if (!member) continue;

    const fullName = [
      member.first_name,
      member.middle_name,
      member.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const existing = accountMap.get(link.user_id);

    if (existing) {
      existing.members.push(fullName);
    } else {
      accountMap.set(link.user_id, {
        userId: link.user_id,
        members: [fullName],
      });
    }
  }

  const accounts = [];

  for (const account of accountMap.values()) {
    const { data, error } = await admin.auth.admin.getUserById(
      account.userId,
    );

    if (error) {
      throw new Error(error.message);
    }

    accounts.push({
      userId: account.userId,
      email: data.user.email ?? "—",
      members: account.members,
    });
  }

  return (
    <main>
      <h1>Member Accounts</h1>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Linked Members</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {accounts.map((account) => (
            <tr key={account.userId}>
              <td>
                <Link href={`/staff/admin/accounts/${account.userId}`}>
                  {account.email}
                </Link>
              </td>

              <td>
                {account.members.map((member) => (
                  <div key={member}>{member}</div>
                ))}
              </td>

              <td>
                <Link
                  href={`/staff/admin/members/invite?email=${encodeURIComponent(
                    account.email,
                  )}`}
                >
                  Link Members
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}