import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/read-all-pages";

import {
  getAccessibleActiveBranches,
} from "../services/access";
import type { ContributionAccess } from "./access";
import { normalizeContributionAmount } from "./types";
import type {
  ContributionBranch,
  ContributionMemberOption,
  ContributionRecord,
  ContributionServiceOption,
} from "./types";

type ContributionRow = {
  id: string;
  member_id: string | null;
  contributor_type: ContributionRecord["contributorType"];
  visitor_name: string | null;
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
  church_branches?: { name: string } | null;
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
  contributorType: ContributionRecord["contributorType"];
  visitorName: string | null;
  serviceId: string | null;
  churchBranchId: string;
  contributionType: ContributionRecord["contributionType"];
  amount: string;
  contributionDate: string;
  paymentMethod: ContributionRecord["paymentMethod"];
  recordedBy: string | null;
  notes: string | null;
};

export async function loadContributionOptions(
  access: ContributionAccess,
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

  const [members, services] = await Promise.all([
    readAllPages((from, to) => admin
      .from("members")
      .select(
        "id, first_name, middle_name, last_name, church_branch_id, is_archived, church_branches(name)",
      )
      .eq("is_archived", false)
      .order("last_name")
      .order("first_name").range(from, to)),
    readAllPages((from, to) => admin
      .from("services")
      .select(
        "id, name, service_date, church_branch_id, status",
      )
      .in("church_branch_id", branchIds)
      .order("service_date", { ascending: false })
      .order("name").range(from, to)),
  ]);

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
      homeBranchName: (member.church_branches as unknown as { name: string } | null)?.name ?? "Unassigned home branch",
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

  const rows = await readAllPages((from, to) => admin
    .from("financial_contributions")
    .select(
      "id, member_id, contributor_type, visitor_name, service_id, church_branch_id, contribution_type, amount, contribution_date, payment_method, recorded_by, notes",
    )
    .in("church_branch_id", branchIds)
    .order("contribution_date", { ascending: false }).order("id")
    .range(from, to)) as ContributionRow[];
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
            "id, first_name, middle_name, last_name, church_branch_id, is_archived, church_branches(name)",
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
    contributorType: row.contributor_type,
    visitorName: row.visitor_name,
    memberHomeBranchName: ((memberResult.data ?? []) as MemberRow[]).find(m => m.id === row.member_id)?.church_branches?.name,
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
    amount: normalizeContributionAmount(row.amount),
    contributionDate: row.contribution_date,
    paymentMethod: row.payment_method as ContributionRecord["paymentMethod"],
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by
      ? profiles.get(row.recorded_by) ?? null
      : null,
    notes: row.notes,
  }));
}

/** Call only after loading the contribution through its stored branch scope. */
export async function loadContributionEditOptions(
  access: ContributionAccess,
  admin: ReturnType<typeof createAdminClient>,
  contribution: ContributionEditRecord,
) {
  const options = await loadContributionOptions({ ...access, isSystemAdmin: false, branchIds: [contribution.churchBranchId] }, admin);
  // The existing identity is resolved by its recorded ID, not today's roster.
  // Do not expose the member's new, possibly inaccessible branch assignment.
  if (contribution.memberId && !options.members.some((member) => member.id === contribution.memberId)) {
    const { data, error } = await admin.from("members").select("id, first_name, middle_name, last_name, is_archived")
      .eq("id", contribution.memberId).maybeSingle();
    if (error) throw new Error("Unable to load the historical contributor.");
    options.members.push({ id: contribution.memberId, homeBranchName: "Historical home branch", fullName: data ? formatMemberName(data) : "Unknown member",
      churchBranchId: "", isArchived: data?.is_archived ?? false });
  }
  if (contribution.serviceId && !options.services.some((service) => service.id === contribution.serviceId)) {
    const { data, error } = await admin.from("services").select("id, name, service_date, status")
      .eq("id", contribution.serviceId).maybeSingle();
    if (error) throw new Error("Unable to load the historical service.");
    options.services.push({ id: contribution.serviceId, name: data?.name ?? "Unknown service",
      serviceDate: data?.service_date ?? "", churchBranchId: "", status: data?.status ?? "unknown" });
  }
  return options;
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
      "id, member_id, contributor_type, visitor_name, service_id, church_branch_id, contribution_type, amount, contribution_date, payment_method, recorded_by, notes",
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
    contributorType: row.contributor_type,
    visitorName: row.visitor_name,
    serviceId: row.service_id,
    churchBranchId: row.church_branch_id,
    contributionType: row.contribution_type as ContributionRecord["contributionType"],
    amount: normalizeContributionAmount(row.amount),
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
