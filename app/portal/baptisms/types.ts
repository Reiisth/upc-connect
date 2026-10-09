export const BAPTISM_TYPES = [
  "water",
  "holy_ghost",
] as const;

export type BaptismType = (typeof BAPTISM_TYPES)[number];

export type BaptismBranch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type BaptismMemberOption = {
  id: string;
  fullName: string;
  churchBranchId: string;
  memberStatus: string | null;
  isArchived: boolean;
};

export type BaptismRecord = {
  id: string;
  memberId: string;
  memberName: string;
  memberStatus: string | null;
  memberIsArchived: boolean;
  baptismType: BaptismType;
  baptismDate: string | null;
  churchBranchId: string;
  branch: BaptismBranch | null;
  officiatedBy: string | null;
  location: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  notes: string | null;
};

export type BaptismSummary = {
  count: number;
  waterCount: number;
  holyGhostCount: number;
};

export type BaptismFormValues = {
  memberId: string;
  baptismType: BaptismType;
  baptismDate: string;
  churchBranchId: string;
  officiatedBy: string;
  location: string;
  notes: string;
};

export type BaptismActionState = {
  error: string | null;
};

export type BaptismAction = (
  previousState: BaptismActionState,
  formData: FormData,
) => Promise<BaptismActionState>;

export const initialBaptismActionState: BaptismActionState = {
  error: null,
};

export function formatBaptismType(value: string) {
  if (value === "holy_ghost") return "Holy Ghost";
  if (value === "water") return "Water";

  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function formatMemberName(member: {
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

export function isActiveMember(member: {
  memberStatus: string | null;
  isArchived: boolean;
}) {
  return !member.isArchived && member.memberStatus === "active";
}

export function getBaptismSummary(
  records: BaptismRecord[],
): BaptismSummary {
  return records.reduce<BaptismSummary>(
    (summary, record) => {
      summary.count += 1;

      if (record.baptismType === "water") {
        summary.waterCount += 1;
      }

      if (record.baptismType === "holy_ghost") {
        summary.holyGhostCount += 1;
      }

      return summary;
    },
    {
      count: 0,
      waterCount: 0,
      holyGhostCount: 0,
    },
  );
}
