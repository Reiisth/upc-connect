import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPortalPage() {
  const admin = createAdminClient();

  const [
    { count: totalMembers },
    { data: accountLinks },
    { count: incompleteProfiles },
    { count: staffAccounts },
  ] = await Promise.all([
    admin
      .from("members")
      .select("*", { count: "exact", head: true }),

    admin
      .from("account_members")
      .select("user_id"),

    admin
      .from("members")
      .select("*", { count: "exact", head: true })
      .neq("profile_status", "completed"),

    admin
      .from("user_roles")
      .select(`
        user_id,
        roles!inner(name)
      `, { count: "exact", head: true })
      .neq("roles.name", "member"),
  ]);

  const linkedAccounts = new Set(
    (accountLinks ?? []).map((link) => link.user_id),
  ).size;

  const cards = [
    {
      label: "Total Members",
      value: totalMembers ?? 0,
    },
    {
      label: "Linked Accounts",
      value: linkedAccounts ?? 0,
    },
    {
      label: "Incomplete Profiles",
      value: incompleteProfiles ?? 0,
    },
    {
      label: "Staff Accounts",
      value: staffAccounts ?? 0,
    },
  ];

  return (
    <section>
      <div>
        <p className="text-sm font-medium text-[#5D94E8]">
          System Overview
        </p>

        <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
          Administrative Dashboard
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Monitor members, accounts, profiles, and staff access across UPC Connect.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {card.label}
            </p>

            <p className="mt-3 font-heading text-3xl font-semibold text-[#203264]">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}