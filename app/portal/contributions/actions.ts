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
  type ContributionType,
  type PaymentMethod,
} from "./types";
import { requireContributionManager } from "./access";

const contributionsPath = "/portal/contributions";

function getFormText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Enter a valid contribution date.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid contribution date.");
  }

  return value;
}

function validateAmount(value: string) {
  if (!value) {
    throw new Error("Contribution amount is required.");
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Contribution amount must be greater than zero.");
  }

  return amount;
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
    throw new Error("A church branch is required.");
  }

  if (!CONTRIBUTION_TYPES.includes(contributionType)) {
    throw new Error("Select a valid contribution type.");
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error("Select a valid payment method.");
  }

  if (notes.length > 2000) {
    throw new Error("Notes must be 2,000 characters or fewer.");
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
) {
  if (!memberId) return;

  const { data, error } = await admin
    .from("members")
    .select("id, church_branch_id")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("The selected member could not be found.");
  }

  if (data.church_branch_id !== branchId) {
    throw new Error(
      "The selected member does not belong to the selected branch.",
    );
  }
}

async function validateServiceForBranch(
  admin: ReturnType<typeof createAdminClient>,
  serviceId: string | null,
  branchId: string,
) {
  if (!serviceId) return;

  const { data, error } = await admin
    .from("services")
    .select("id, church_branch_id")
    .eq("id", serviceId)
    .eq("church_branch_id", branchId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "The selected service does not belong to the selected branch.",
    );
  }
}

export async function createContribution(formData: FormData) {
  const access = await requireContributionManager();
  const payload = validateContributionForm(formData);
  const admin = createAdminClient();

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
    throw new Error(error.message);
  }

  revalidatePath(contributionsPath);

  if (data?.id) {
    revalidatePath(`${contributionsPath}/${data.id}/edit`);
  }

  redirect(contributionsPath);
}

export async function updateContribution(
  contributionId: string,
  formData: FormData,
) {
  const access = await requireContributionManager();

  if (!contributionId) {
    throw new Error("A contribution is required.");
  }

  const payload = validateContributionForm(formData);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("financial_contributions")
    .select("id, church_branch_id, recorded_by")
    .eq("id", contributionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing) {
    throw new Error("The requested contribution could not be found.");
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
  );
  await validateServiceForBranch(
    admin,
    payload.service_id,
    payload.church_branch_id,
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
    throw new Error(error.message);
  }

  revalidatePath(contributionsPath);
  revalidatePath(`${contributionsPath}/${contributionId}/edit`);

  redirect(contributionsPath);
}
