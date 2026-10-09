export const CONTRIBUTION_TYPES = [
  "tithe",
  "love_offering",
  "other",
] as const;

export type ContributionType =
  (typeof CONTRIBUTION_TYPES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "gcash",
  "bank_transfer",
  "other",
] as const;

export type PaymentMethod =
  (typeof PAYMENT_METHODS)[number];

export type ContributionBranch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type ContributionMemberOption = {
  id: string;
  fullName: string;
  churchBranchId: string;
  isArchived: boolean;
};

export type ContributionServiceOption = {
  id: string;
  name: string;
  serviceDate: string;
  churchBranchId: string;
  status: string;
};

export type ContributionRecord = {
  id: string;
  memberId: string | null;
  memberName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  churchBranchId: string;
  branch: ContributionBranch | null;
  contributionType: ContributionType;
  amount: number;
  contributionDate: string;
  paymentMethod: PaymentMethod;
  recordedBy: string | null;
  recordedByName: string | null;
  notes: string | null;
};

export type ContributionSummary = {
  count: number;
  totalAmount: number;
  titheTotal: number;
  loveOfferingTotal: number;
};

export type ContributionFormValues = {
  memberId: string | null;
  serviceId: string | null;
  churchBranchId: string;
  contributionType: ContributionType;
  amount: string;
  contributionDate: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
};

export function formatContributionType(value: string) {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function formatPaymentMethod(value: string) {
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

export function getContributionSummary(
  records: ContributionRecord[],
): ContributionSummary {
  return records.reduce<ContributionSummary>(
    (summary, record) => {
      summary.count += 1;
      summary.totalAmount += record.amount;

      if (record.contributionType === "tithe") {
        summary.titheTotal += record.amount;
      }

      if (record.contributionType === "love_offering") {
        summary.loveOfferingTotal += record.amount;
      }

      return summary;
    },
    {
      count: 0,
      totalAmount: 0,
      titheTotal: 0,
      loveOfferingTotal: 0,
    },
  );
}
