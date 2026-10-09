import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getAccessibleActiveBranches,
  type ServiceAccess,
} from "../services/access";
import type {
  ContributionBranch,
  ContributionMemberOption,
  ContributionRecord,
  ContributionServiceOption,
} from "./types";

type ContributionRow = {
  id: string;
  member_id: string | null;
  service_id: string | null;
  church_branch_id: string;
  contribution_type: string;
  amount: number | string;
  contribution_date: string;
  payment_method: string;
  recorded_by: string | null;
  notes: string | null;
};

type MemberRow = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  church_branch_id: string | null;
  is_archived: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  service_date: string;
  church_branch_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

export type ContributionEditRecord = {
  id: string;
  memberId: string | null;
  serviceId: string | null;
  churchBranchId: string;
  contributionType: ContributionRecord["contributionType"];
  amount: number;
  contributionDate: string;
  paymentMethod: ContributionRecord["paymentMethod"];
  recordedBy: string | null;
  notes: string | null;
};

export async function loadContributionOptions(
  access: ServiceAccess,
  admin: ReturnType<typeof createAdminClient>,
) {
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: branches as ContributionBranch[],
      members: [] as ContributionMemberOption[],
      services: [] as ContributionServiceOption[],
    };
  }

  const [memberResult, serviceResult] = await Promise.all([
    admin
      .from("members")
      .select(
        "id, first_name, middle_name, last_name, church_branch_id, is_archived",
      )
      .in("church_branch_id", branchIds)
      .order("last_name")
      .order("first_name"),
    admin
      .from("services")
      .select(
        "id, name, service_date, church_branch_id, status",
      )
      .in("church_branch_id", branchIds)
      .order("service_date", { ascending: false })
      .order("name"),
  ]);

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  if (serviceResult.error) {
    throw new Error(serviceResult.error.message);
  }

  const members = (memberResult.data ?? []) as MemberRow[];
  const services = (serviceResult.data ?? []) as ServiceRow[];

  return {
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isActive: branch.isActive,
    } satisfies ContributionBranch)),
    members: members.map((member) => ({
      id: member.id,
      fullName: formatMemberName(member),
      churchBranchId: member.church_branch_id ?? "",
      isArchived: member.is_archived,
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      serviceDate: service.service_date,
      churchBranchId: service.church_branch_id,
      status: service.status,
    })),
  };
}

export async function loadContributionRecords(
  admin: ReturnType<typeof createAdminClient>,
  branches: ContributionBranch[],
) {
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return [] as ContributionRecord[];
  }

  const { data, error } = await admin
    .from("financial_contributions")
    .select(
      "id, member_id, service_id, church_branch_id, contribution_type, amount, contribution_date, payment_method, recorded_by, notes",
    )
    .in("church_branch_id", branchIds)
    .order("contribution_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ContributionRow[];
  const memberIds = Array.from(
    new Set(
      rows
        .map((row) => row.member_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const serviceIds = Array.from(
    new Set(
      rows
        .map((row) => row.service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const recorderIds = Array.from(
    new Set(
      rows
        .map((row) => row.recorded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [memberResult, serviceResult, profileResult] =
    await Promise.all([
      memberIds.length > 0
        ? admin
          .from("members")
          .select(
            "id, first_name, middle_name, last_name, church_branch_id, is_archived",
          )
          .in("id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      serviceIds.length > 0
        ? admin
          .from("services")
          .select(
            "id, name, service_date, church_branch_id, status",
          )
          .in("id", serviceIds)
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

  if (serviceResult.error) {
    throw new Error(serviceResult.error.message);
  }

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  const members = new Map(
    ((memberResult.data ?? []) as MemberRow[]).map((member) => [
      member.id,
      formatMemberName(member),
    ]),
  );
  const services = new Map(
    ((serviceResult.data ?? []) as ServiceRow[]).map((service) => [
      service.id,
      service.name,
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

  return rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_id
      ? members.get(row.member_id) ?? "Unknown member"
      : null,
    serviceId: row.service_id,
    serviceName: row.service_id
      ? services.get(row.service_id) ?? "Unknown service"
      : null,
    churchBranchId: row.church_branch_id,
    branch: branchMap.get(row.church_branch_id) ?? null,
    contributionType: row.contribution_type as ContributionRecord["contributionType"],
    amount: Number(row.amount),
    contributionDate: row.contribution_date,
    paymentMethod: row.payment_method as ContributionRecord["paymentMethod"],
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by
      ? profiles.get(row.recorded_by) ?? null
      : null,
    notes: row.notes,
  }));
}

export async function loadContributionForEdit(
  admin: ReturnType<typeof createAdminClient>,
  branches: ContributionBranch[],
  contributionId: string,
) {
  const branchIds = branches.map((branch) => branch.id);

  if (!contributionId || branchIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("financial_contributions")
    .select(
      "id, member_id, service_id, church_branch_id, contribution_type, amount, contribution_date, payment_method, recorded_by, notes",
    )
    .eq("id", contributionId)
    .in("church_branch_id", branchIds)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as ContributionRow;

  return {
    id: row.id,
    memberId: row.member_id,
    serviceId: row.service_id,
    churchBranchId: row.church_branch_id,
    contributionType: row.contribution_type as ContributionRecord["contributionType"],
    amount: Number(row.amount),
    contributionDate: row.contribution_date,
    paymentMethod: row.payment_method as ContributionRecord["paymentMethod"],
    recordedBy: row.recorded_by,
    notes: row.notes,
  } satisfies ContributionEditRecord;
}

function formatMemberName(member: {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}) {
  return [
    member.first_name,
    member.middle_name,
    member.last_name,
  ]
    .filter(Boolean)
    .join(" ") || "Unnamed member";
}
