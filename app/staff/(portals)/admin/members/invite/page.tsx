import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { inviteMembers } from "../actions";

export default async function InviteMembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    memberId?: string;
    email?: string;
  }>;
}) {
  await requireRole("system_admin");

  const { memberId, email } = await searchParams;
  const admin = createAdminClient();

  const { data: members, error: membersError } = await admin
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      account_status
    `)
    .order("last_name");

  if (membersError) {
    throw new Error(membersError.message);
  }

  // Load existing Auth accounts.
  const existingEmails: string[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      if (user.email) {
        existingEmails.push(user.email);
      }
    }

    if (data.users.length < 1000) {
      break;
    }

    page++;
  }

  existingEmails.sort((a, b) => a.localeCompare(b));

  async function action(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();

    const memberIds = formData
      .getAll("member_ids")
      .map((value) => String(value));

    await inviteMembers(memberIds, email);
  }

  return (
    <main>
      <h1>Connect Members to Account</h1>

      <form action={action}>
        <div>
          <label htmlFor="email">Account Email</label>

          <input
            id="email"
            name="email"
            type="email"
            list="existing-accounts"
            defaultValue={email ?? ""}
            placeholder="Search existing email or enter a new one"
            autoComplete="off"
            required
          />

          <datalist id="existing-accounts">
            {existingEmails.map((email) => (
              <option key={email} value={email} />
            ))}
          </datalist>
        </div>

        <fieldset>
          <legend>Select members</legend>

          {members?.map((member) => {
            const fullName = [
              member.first_name,
              member.middle_name,
              member.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <label key={member.id}>
                <input
                  type="checkbox"
                  name="member_ids"
                  value={member.id}
                  defaultChecked={member.id === memberId}
                />

                {fullName} ({member.account_status})
              </label>
            );
          })}
        </fieldset>

        <button type="submit">Connect Members</button>
      </form>
    </main>
  );
}