export type WeddingSpouseSource = "member" | "external";

export type WeddingBranch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type WeddingMemberOption = {
  id: string;
  fullName: string;
  churchBranchId: string;
  memberStatus: string | null;
  isArchived: boolean;
};

export type WeddingRecord = {
  id: string;
  memberId: string;
  memberName: string;
  memberStatus: string | null;
  memberIsArchived: boolean;
  spouseMemberId: string | null;
  spouseName: string | null;
  spouseDisplayName: string;
  spouseMemberIsArchived: boolean;
  weddingDate: string;
  churchBranchId: string;
  branch: WeddingBranch | null;
  officiatedBy: string | null;
  location: string | null;
  certificateNumber: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  notes: string | null;
};

export type WeddingEditRecord = {
  id: string;
  memberId: string;
  spouseMemberId: string | null;
  spouseName: string | null;
  weddingDate: string;
  churchBranchId: string;
  officiatedBy: string | null;
  location: string | null;
  certificateNumber: string | null;
  recordedBy: string | null;
  notes: string | null;
};

export type WeddingFormValues = {
  memberId: string;
  spouseSource: WeddingSpouseSource;
  spouseMemberId: string | null;
  spouseName: string;
  weddingDate: string;
  churchBranchId: string;
  officiatedBy: string;
  location: string;
  certificateNumber: string;
  notes: string;
};

export type WeddingActionState = {
  error: string | null;
};

export type WeddingAction = (
  previousState: WeddingActionState,
  formData: FormData,
) => Promise<WeddingActionState>;

export const initialWeddingActionState: WeddingActionState = {
  error: null,
};

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

export function isActiveWeddingMember(member: {
  memberStatus: string | null;
  isArchived: boolean;
}) {
  return !member.isArchived && member.memberStatus === "active";
}

export function formatWeddingDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}
