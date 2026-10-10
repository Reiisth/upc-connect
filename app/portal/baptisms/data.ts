import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getAccessibleActiveBranches,
} from "../services/access";
import type { BaptismAccess } from "./access";
import type {
  BaptismBranch,
  BaptismMemberOption,
  BaptismRecord,
  BaptismType,
} from "./types";
import { formatMemberName } from "./types";

type BaptismRow = {
  id: string;
  member_id: string;
  baptism_type: string;
  baptism_date: string | null;
  church_branch_id: string;
  officiated_by: string | null;
  location: string | null;
  recorded_by: string | null;
  notes: string | null;
};

type MemberRow = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  member_status: string | null;
  is_archived: boolean;
  church_branch_id: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

export type BaptismEditRecord = {
  id: string;
  memberId: string;
  baptismType: BaptismType;
  baptismDate: string | null;
  churchBranchId: string;
  officiatedBy: string | null;
  location: string | null;
  recordedBy: string | null;
  notes: string | null;
};

export async function loadBaptismOptions(
  access: BaptismAccess,
  admin: ReturnType<typeof createAdminClient>,
) {
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: [] as BaptismBranch[],
      members: [] as BaptismMemberOption[],
    };
  }

  const { data, error } = await admin
    .from("members")
    .select(
      "id, first_name, middle_name, last_name, member_status, is_archived, church_branch_id",
    )
    .in("church_branch_id", branchIds)
    .order("last_name")
    .order("first_name");

  if (error) {
    throw new Error(error.message);
  }

  const members = (data ?? []) as MemberRow[];

  return {
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isActive: branch.isActive,
    } satisfies BaptismBranch)),
    members: members.map((member) => ({
      id: member.id,
      fullName: formatMemberName(member),
      churchBranchId: member.church_branch_id ?? "",
      memberStatus: member.member_status,
      isArchived: member.is_archived,
    })),
  };
}

export async function loadBaptismRecords(
  admin: ReturnType<typeof createAdminClient>,
  branches: BaptismBranch[],
) {
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return [] as BaptismRecord[];
  }

  const { data, error } = await admin
    .from("baptism_records")
    .select(
      "id, member_id, baptism_type, baptism_date, church_branch_id, officiated_by, location, recorded_by, notes",
    )
    .in("church_branch_id", branchIds)
    .order("baptism_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BaptismRow[];
  const memberIds = Array.from(
    new Set(rows.map((row) => row.member_id).filter(Boolean)),
  );
  const recorderIds = Array.from(
    new Set(
      rows
        .map((row) => row.recorded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [memberResult, profileResult] = await Promise.all([
    memberIds.length > 0
      ? admin
        .from("members")
        .select(
          "id, first_name, middle_name, last_name, member_status, is_archived, church_branch_id",
        )
        .in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    recorderIds.length > 0
      ? admin
        .from("profiles")
        .select("id, display_name")
        .in("id", recorderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  const members = new Map(
    ((memberResult.data ?? []) as MemberRow[]).map((member) => [
      member.id,
      {
        name: formatMemberName(member),
        memberStatus: member.member_status,
        isArchived: member.is_archived,
      },
    ]),
  );
  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const branchMap = new Map(
    branches.map((branch) => [branch.id, branch]),
  );

  return rows.map((row) => {
    const member = members.get(row.member_id);

    return {
      id: row.id,
      memberId: row.member_id,
      memberName: member?.name ?? "Unknown member",
      memberStatus: member?.memberStatus ?? null,
      memberIsArchived: member?.isArchived ?? false,
      baptismType: row.baptism_type as BaptismType,
      baptismDate: row.baptism_date,
      churchBranchId: row.church_branch_id,
      branch: branchMap.get(row.church_branch_id) ?? null,
      officiatedBy: row.officiated_by,
      location: row.location,
      recordedBy: row.recorded_by,
      recordedByName: row.recorded_by
        ? profiles.get(row.recorded_by) ?? null
        : null,
      notes: row.notes,
    } satisfies BaptismRecord;
  });
}

export async function loadBaptismForEdit(
  admin: ReturnType<typeof createAdminClient>,
  branches: BaptismBranch[],
  baptismId: string,
) {
  const branchIds = branches.map((branch) => branch.id);

  if (!baptismId || branchIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("baptism_records")
    .select(
      "id, member_id, baptism_type, baptism_date, church_branch_id, officiated_by, location, recorded_by, notes",
    )
    .eq("id", baptismId)
    .in("church_branch_id", branchIds)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as BaptismRow;

  return {
    id: row.id,
    memberId: row.member_id,
    baptismType: row.baptism_type as BaptismType,
    baptismDate: row.baptism_date,
    churchBranchId: row.church_branch_id,
    officiatedBy: row.officiated_by,
    location: row.location,
    recordedBy: row.recorded_by,
    notes: row.notes,
  } satisfies BaptismEditRecord;
}
