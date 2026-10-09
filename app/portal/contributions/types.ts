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
  amount: string;
  contributionDate: string;
  paymentMethod: PaymentMethod;
  recordedBy: string | null;
  recordedByName: string | null;
  notes: string | null;
};

export type ContributionSummary = {
  count: number;
  totalAmountCents: number;
  titheTotalCents: number;
  loveOfferingTotalCents: number;
};

export type ContributionActionState = {
  error: string | null;
};

export type ContributionAction = (
  previousState: ContributionActionState,
  formData: FormData,
) => Promise<ContributionActionState>;

export const initialContributionActionState: ContributionActionState = {
  error: null,
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

/**
 * Convert a numeric(12,2) value to integer cents without accumulating money
 * using JavaScript floating-point arithmetic.
 */
export function contributionAmountToCents(
  value: string | number,
) {
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) {
    throw new Error("Contribution amount must have at most two decimals.");
  }

  const cents = Number(
    `${match[1]}${(match[2] ?? "").padEnd(2, "0")}`,
  );

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Contribution amount is too large.");
  }

  return cents;
}

export function normalizeContributionAmount(
  value: string | number,
) {
  const cents = contributionAmountToCents(value);

  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function formatContributionAmount(
  value: string | number,
) {
  return formatContributionCents(contributionAmountToCents(value));
}

export function formatContributionCents(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function getContributionSummary(
  records: ContributionRecord[],
): ContributionSummary {
  return records.reduce<ContributionSummary>(
    (summary, record) => {
      const amountCents = contributionAmountToCents(record.amount);

      summary.count += 1;
      summary.totalAmountCents += amountCents;

      if (record.contributionType === "tithe") {
        summary.titheTotalCents += amountCents;
      }

      if (record.contributionType === "love_offering") {
        summary.loveOfferingTotalCents += amountCents;
      }

      return summary;
    },
    {
      count: 0,
      totalAmountCents: 0,
      titheTotalCents: 0,
      loveOfferingTotalCents: 0,
    },
  );
}
