"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  assertActiveServiceBranch,
} from "../services/access";
import {
  CONTRIBUTION_TYPES,
  PAYMENT_METHODS,
  contributionAmountToCents,
  normalizeContributionAmount,
  type ContributionActionState,
  type ContributionType,
  type PaymentMethod,
} from "./types";
import { requireContributionsPermission } from "./access";

const contributionsPath = "/portal/contributions";

class ContributionValidationError extends Error {}

const safeBranchAccessErrors = new Set([
  "A church branch is required.",
  "You can only use church branches assigned to your account.",
  "The selected church branch does not exist or is inactive.",
]);

function getActionErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof ContributionValidationError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    safeBranchAccessErrors.has(error.message)
  ) {
    return error.message;
  }

  console.error("Contribution action failed", error);
  return fallback;
}

function throwDatabaseFailure(
  context: string,
  error: unknown,
): never {
  console.error(`Contribution database failure: ${context}`, error);
  throw new Error("Contribution database operation failed.");
}

function getFormText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ContributionValidationError(
      "Enter a valid contribution date.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ContributionValidationError(
      "Enter a valid contribution date.",
    );
  }

  return value;
}

function validateAmount(value: string) {
  if (!value) {
    throw new ContributionValidationError(
      "Contribution amount is required.",
    );
  }

  try {
    const normalized = normalizeContributionAmount(value);
    const cents = contributionAmountToCents(normalized);

    if (cents <= 0) {
      throw new ContributionValidationError(
        "Contribution amount must be greater than zero.",
      );
    }

    if (cents > 999_999_999_999) {
      throw new ContributionValidationError(
        "Contribution amount is too large.",
      );
    }

    return normalized;
  } catch (error) {
    if (error instanceof ContributionValidationError) {
      throw error;
    }

    throw new ContributionValidationError(
      "Enter a valid amount with no more than two decimal places.",
    );
  }
}

function validateContributionForm(formData: FormData) {
  const memberId = getFormText(formData, "member_id") || null;
  const serviceId = getFormText(formData, "service_id") || null;
  const churchBranchId = getFormText(
    formData,
    "church_branch_id",
  );
  const contributionType = getFormText(
    formData,
    "contribution_type",
  ) as ContributionType;
  const amountValue = getFormText(formData, "amount");
  const contributionDate = getFormText(
    formData,
    "contribution_date",
  );
  const paymentMethod = getFormText(
    formData,
    "payment_method",
  ) as PaymentMethod;
  const notes = getFormText(formData, "notes");

  if (!churchBranchId) {
    throw new ContributionValidationError(
      "A church branch is required.",
    );
  }

  if (!CONTRIBUTION_TYPES.includes(contributionType)) {
    throw new ContributionValidationError(
      "Select a valid contribution type.",
    );
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ContributionValidationError(
      "Select a valid payment method.",
    );
  }

  if (notes.length > 2000) {
    throw new ContributionValidationError(
      "Notes must be 2,000 characters or fewer.",
    );
  }

  return {
    member_id: memberId,
    service_id: serviceId,
    church_branch_id: churchBranchId,
    contribution_type: contributionType,
    amount: validateAmount(amountValue),
    contribution_date: validateDate(contributionDate),
    payment_method: paymentMethod,
    notes: notes || null,
  };
}

async function validateMemberForBranch(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string | null,
  branchId: string,
  allowedArchivedMemberId: string | null = null,
) {
  if (!memberId) return;

  const { data, error } = await admin
    .from("members")
    .select("id, church_branch_id, is_archived")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throwDatabaseFailure("member validation", error);
  }

  if (!data) {
    throw new ContributionValidationError(
      "The selected member could not be found.",
    );
  }

  if (data.church_branch_id !== branchId) {
    throw new ContributionValidationError(
      "The selected member does not belong to the selected branch.",
    );
  }

  if (data.is_archived && memberId !== allowedArchivedMemberId) {
    throw new ContributionValidationError(
      "Archived members cannot be linked to a new contribution.",
    );
  }
}

async function validateServiceForBranch(
  admin: ReturnType<typeof createAdminClient>,
  serviceId: string | null,
  branchId: string,
  allowedCancelledServiceId: string | null = null,
) {
  if (!serviceId) return;

  const { data, error } = await admin
    .from("services")
    .select("id, church_branch_id, status")
    .eq("id", serviceId)
    .eq("church_branch_id", branchId)
    .maybeSingle();

  if (error) {
    throwDatabaseFailure("service validation", error);
  }

  if (!data) {
    throw new ContributionValidationError(
      "The selected service does not belong to the selected branch.",
    );
  }

  if (
    data.status === "cancelled" &&
    serviceId !== allowedCancelledServiceId
  ) {
    throw new ContributionValidationError(
      "Cancelled services cannot be linked to new contributions.",
    );
  }
}

export async function createContribution(
  _previousState: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const access = await requireContributionsPermission(
    "contributions.create",
  );
  const admin = createAdminClient();
  let contributionId: string | null = null;

  try {
    const payload = validateContributionForm(formData);

    await assertActiveServiceBranch(
      admin,
      access,
      payload.church_branch_id,
    );
    await validateMemberForBranch(
      admin,
      payload.member_id,
      payload.church_branch_id,
    );
    await validateServiceForBranch(
      admin,
      payload.service_id,
      payload.church_branch_id,
    );

    const { data, error } = await admin
      .from("financial_contributions")
      .insert({
        ...payload,
        recorded_by: access.user.id,
      })
      .select("id")
      .single();

    if (error) {
      throwDatabaseFailure("creating contribution", error);
    }

    contributionId = data?.id ?? null;
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The contribution could not be saved. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(contributionsPath);

  if (contributionId) {
    revalidatePath(`${contributionsPath}/${contributionId}/edit`);
  }

  redirect(contributionsPath);
}

export async function updateContribution(
  contributionId: string,
  _previousState: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const access = await requireContributionsPermission(
    "contributions.update",
  );
  const admin = createAdminClient();
  try {
    if (!contributionId) {
      throw new ContributionValidationError(
        "A contribution is required.",
      );
    }

    const payload = validateContributionForm(formData);
    const { data: existing, error: existingError } = await admin
      .from("financial_contributions")
      .select("id, member_id, service_id, church_branch_id, recorded_by")
      .eq("id", contributionId)
      .maybeSingle();

    if (existingError) {
      throwDatabaseFailure("loading contribution", existingError);
    }

    if (!existing) {
      throw new ContributionValidationError(
        "The requested contribution could not be found.",
      );
    }

    await assertActiveServiceBranch(
      admin,
      access,
      existing.church_branch_id,
    );
    await assertActiveServiceBranch(
      admin,
      access,
      payload.church_branch_id,
    );
    await validateMemberForBranch(
      admin,
      payload.member_id,
      payload.church_branch_id,
      existing.member_id === payload.member_id
        ? existing.member_id
        : null,
    );
    await validateServiceForBranch(
      admin,
      payload.service_id,
      payload.church_branch_id,
      existing.service_id === payload.service_id
        ? existing.service_id
        : null,
    );

    const { error } = await admin
      .from("financial_contributions")
      .update({
        ...payload,
        // Keep the original recorder for audit history. If legacy data lacks
        // one, derive it from the authenticated accounting officer.
        recorded_by: existing.recorded_by ?? access.user.id,
      })
      .eq("id", contributionId);

    if (error) {
      throwDatabaseFailure("updating contribution", error);
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The contribution could not be updated. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(contributionsPath);
  revalidatePath(`${contributionsPath}/${contributionId}/edit`);

  redirect(contributionsPath);
}
