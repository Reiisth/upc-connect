import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FollowUpAccess } from "./access";
import {
  isUuid, memberName, type FollowUpBranch, type FollowUpMember, type FollowUpPerformer, type FollowUpRecord,
} from "./types";

type Admin = ReturnType<typeof createAdminClient>;
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function allRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) { console.error("Follow-up data load failed", error); throw new Error("Unable to load follow-up information. Please try again."); }
    rows.push(...data ?? []);
    if (!data || data.length < 500) return rows;
  }
}

export async function loadFollowUpBranches(access: FollowUpAccess, admin: Admin): Promise<FollowUpBranch[]> {
  if (!access.branchIds.length) return [];
  const rows = await allRows((from, to) => admin.from("church_branches")
    .select("id, name, code, is_active").in("id", access.branchIds).order("name").order("id").range(from, to));
  return rows.map((row) => ({ id: row.id, name: row.name, code: row.code, isActive: row.is_active }));
}

/** Staff/member overlap is valid: any active staff role qualifies a non-archived profile. */
export async function loadFollowUpPerformers(admin: Admin): Promise<FollowUpPerformer[]> {
  const links = await allRows((from, to) => admin.from("user_roles")
    .select("user_id, role_id, roles!inner(is_staff, is_active)")
    .eq("roles.is_staff", true).eq("roles.is_active", true).order("user_id").order("role_id").range(from, to));
  const ids = [...new Set(links.map((link) => link.user_id as string))];
  const performers: FollowUpPerformer[] = [];
  for (let index = 0; index < ids.length; index += 200) {
    const rows = await allRows((from, to) => admin.from("profiles")
      .select("id, display_name").in("id", ids.slice(index, index + 200)).is("archived_at", null)
      .order("id").range(from, to));
    performers.push(...rows.map((row) => ({ id: row.id, name: row.display_name?.trim() || "Unnamed staff account" })));
  }
  return performers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadFollowUpFormOptions(access: FollowUpAccess, admin: Admin) {
  const branches = (await loadFollowUpBranches(access, admin)).filter((branch) => branch.isActive);
  const [members, performers] = await Promise.all([
    branches.length ? allRows((from, to) => admin.from("members")
      .select("id, first_name, middle_name, last_name, church_branch_id, is_archived")
      .in("church_branch_id", branches.map((branch) => branch.id)).order("id").range(from, to)) : [],
    loadFollowUpPerformers(admin),
  ]);
  return {
    branches, performers,
    members: members.map((member) => ({ id: member.id, name: memberName(member),
      branchId: member.church_branch_id, isArchived: member.is_archived } satisfies FollowUpMember)),
  };
}

const recordSelect = `id, church_branch_id, member_id, follow_up_date, method, outcome,
  followed_up_by, notes, next_follow_up_date, created_by,
  member:members!member_follow_ups_member_id_fkey(first_name, middle_name, last_name),
  branch:church_branches!member_follow_ups_church_branch_id_fkey(name, is_active),
  performer:profiles!member_follow_ups_followed_up_by_fkey(display_name)`;

type Related<T> = T | T[] | null;
type RecordRow = {
  id: string; church_branch_id: string; member_id: string; follow_up_date: string;
  method: FollowUpRecord["method"]; outcome: FollowUpRecord["outcome"];
  followed_up_by: string | null; notes: string | null; next_follow_up_date: string | null; created_by: string | null;
  member: Related<{ first_name: string | null; middle_name: string | null; last_name: string | null }>;
  branch: Related<{ name: string; is_active: boolean }>;
  performer: Related<{ display_name: string | null }>;
};
function related<T>(value: Related<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function mapRecord(row: RecordRow): FollowUpRecord {
  const member = related(row.member), branch = related(row.branch), performer = related(row.performer);
  return {
    id: row.id, memberId: row.member_id, memberName: member ? memberName(member) : "Unknown member",
    branchId: row.church_branch_id, branchName: branch?.name ?? "Unknown branch", branchIsActive: branch?.is_active ?? false,
    followUpDate: row.follow_up_date, method: row.method, outcome: row.outcome, followedUpBy: row.followed_up_by,
    performerName: performer?.display_name ?? null, notes: row.notes, nextFollowUpDate: row.next_follow_up_date, createdBy: row.created_by,
  };
}

export async function loadFollowUpRecords(access: FollowUpAccess, admin: Admin, memberId?: string): Promise<FollowUpRecord[]> {
  if (!access.branchIds.length) return [];
  const rows = await allRows((from, to) => {
    let query = admin.from("member_follow_ups").select(recordSelect).in("church_branch_id", access.branchIds);
    if (memberId) query = query.eq("member_id", memberId);
    return query.order("follow_up_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to);
  });
  return (rows as unknown as RecordRow[]).map(mapRecord);
}

export async function loadFollowUpForEdit(access: FollowUpAccess, admin: Admin, id: string): Promise<FollowUpRecord | null> {
  if (!isUuid(id) || !access.branchIds.length) return null;
  const { data, error } = await admin.from("member_follow_ups").select(recordSelect)
    .eq("id", id).in("church_branch_id", access.branchIds).maybeSingle();
  if (error) { console.error("Follow-up lookup failed", error); throw new Error("Unable to load this follow-up record."); }
  return data ? mapRecord(data as unknown as RecordRow) : null;
}

/** Current context is visible only through a current branch or accessible historical record. */
export async function loadFollowUpMember(access: FollowUpAccess, admin: Admin, id: string, history: readonly FollowUpRecord[]): Promise<FollowUpMember | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await admin.from("members")
    .select("id, first_name, middle_name, last_name, church_branch_id, is_archived").eq("id", id).maybeSingle();
  if (error) { console.error("Follow-up member lookup failed", error); throw new Error("Unable to load this member."); }
  if (!data || (!access.branchIds.includes(data.church_branch_id) && !history.some((row) => row.memberId === id))) return null;
  return { id: data.id, name: memberName(data), branchId: data.church_branch_id, isArchived: data.is_archived };
}
