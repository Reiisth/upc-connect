import "server-only";

export type AccountAuthUser = {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  invited_at?: string;
  banned_until?: string;
  deleted_at?: string;
};
type AuthAdmin = {
  auth: { admin: { listUsers(options: { page: number; perPage: number }): Promise<{
    data: { users: AccountAuthUser[] };
    error: { message: string } | null;
  }> } };
};

/** Resolve only requested IDs from the paged Auth directory; stop once all are found. */
export async function getAuthUsersByIds(admin: AuthAdmin, userIds: readonly string[]) {
  const wanted = new Set(userIds);
  const found = new Map<string, AccountAuthUser>();
  if (!wanted.size) return found;

  const perPage = 500;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Unable to load account.");
    for (const user of data.users) {
      if (wanted.has(user.id)) found.set(user.id, user);
    }
    if (found.size === wanted.size) return found;
    if (data.users.length < perPage) break;
  }

  throw new Error("Unable to load account.");
}
