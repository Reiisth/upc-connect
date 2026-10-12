import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getAccessibleWeddingBranches,
  type WeddingAccess,
} from "./access";
import type {
  WeddingBranch,
  WeddingEditRecord,
  WeddingMemberOption,
  WeddingRecord,
} from "./types";
import { formatMemberName } from "./types";

type WeddingRow = {
  id: string;
  church_branch_id: string;
  member_id: string;
  spouse_member_id: string | null;
  spouse_name: string | null;
  wedding_date: string;
  officiated_by: string | null;
  location: string | null;
  certificate_number: string | null;
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

export async function loadWeddingOptions(
  access: WeddingAccess,
  admin: ReturnType<typeof createAdminClient>,
) {
  const branches = await getAccessibleWeddingBranches(access, admin);
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: [] as WeddingBranch[],
      members: [] as WeddingMemberOption[],
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
    } satisfies WeddingBranch)),
    members: members.map((member) => ({
      id: member.id,
      fullName: formatMemberName(member),
      churchBranchId: member.church_branch_id ?? "",
      memberStatus: member.member_status,
      isArchived: member.is_archived,
    })),
  };
}

export async function loadWeddingRecords(
  admin: ReturnType<typeof createAdminClient>,
  branches: WeddingBranch[],
) {
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return [] as WeddingRecord[];
  }

  const { data, error } = await admin
    .from("wedding_records")
    .select(
      "id, church_branch_id, member_id, spouse_member_id, spouse_name, wedding_date, officiated_by, location, certificate_number, recorded_by, notes",
    )
    .in("church_branch_id", branchIds)
    .order("wedding_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as WeddingRow[];
  const memberIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.member_id, row.spouse_member_id].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
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
    const spouseMember = row.spouse_member_id
      ? members.get(row.spouse_member_id)
      : null;

    return {
      id: row.id,
      memberId: row.member_id,
      memberName: member?.name ?? "Unknown member",
      memberStatus: member?.memberStatus ?? null,
      memberIsArchived: member?.isArchived ?? false,
      spouseMemberId: row.spouse_member_id,
      spouseName: row.spouse_name,
      spouseDisplayName: row.spouse_member_id
        ? spouseMember?.name ?? "Unknown member"
        : row.spouse_name ?? "Unknown spouse",
      spouseMemberIsArchived: spouseMember?.isArchived ?? false,
      weddingDate: row.wedding_date,
      churchBranchId: row.church_branch_id,
      branch: branchMap.get(row.church_branch_id) ?? null,
      officiatedBy: row.officiated_by,
      location: row.location,
      certificateNumber: row.certificate_number,
      recordedBy: row.recorded_by,
      recordedByName: row.recorded_by
        ? profiles.get(row.recorded_by) ?? null
        : null,
      notes: row.notes,
    } satisfies WeddingRecord;
  });
}

export async function loadWeddingForEdit(
  admin: ReturnType<typeof createAdminClient>,
  branches: WeddingBranch[],
  weddingId: string,
) {
  const branchIds = branches.map((branch) => branch.id);

  if (!weddingId || branchIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("wedding_records")
    .select(
      "id, church_branch_id, member_id, spouse_member_id, spouse_name, wedding_date, officiated_by, location, certificate_number, recorded_by, notes",
    )
    .eq("id", weddingId)
    .in("church_branch_id", branchIds)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as WeddingRow;

  return {
    id: row.id,
    memberId: row.member_id,
    spouseMemberId: row.spouse_member_id,
    spouseName: row.spouse_name,
    weddingDate: row.wedding_date,
    churchBranchId: row.church_branch_id,
    officiatedBy: row.officiated_by,
    location: row.location,
    certificateNumber: row.certificate_number,
    recordedBy: row.recorded_by,
    notes: row.notes,
  } satisfies WeddingEditRecord;
}
