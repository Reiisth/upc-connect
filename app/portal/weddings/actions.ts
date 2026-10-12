"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  assertActiveWeddingBranch,
  requireWeddingsPermission,
} from "./access";
import {
  type WeddingActionState,
  type WeddingSpouseSource,
} from "./types";

const weddingsPath = "/portal/weddings";

class WeddingValidationError extends Error {}

const safeBranchAccessErrors = new Set([
  "A church branch is required.",
  "You can only use church branches assigned to your account.",
  "The selected church branch does not exist or is inactive.",
]);

function getActionErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof WeddingValidationError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    safeBranchAccessErrors.has(error.message)
  ) {
    return error.message;
  }

  console.error("Wedding record action failed", error);
  return fallback;
}

function isDatabaseError(
  error: unknown,
  code: string,
) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function throwDatabaseFailure(
  context: string,
  error: unknown,
): never {
  console.error(`Wedding database failure: ${context}`, error);

  if (isDatabaseError(error, "23503")) {
    throw new WeddingValidationError(
      "One of the selected records no longer exists. Refresh the page and try again.",
    );
  }

  if (isDatabaseError(error, "23514")) {
    throw new WeddingValidationError(
      "The wedding details do not satisfy the record requirements.",
    );
  }

  throw new Error("Wedding record database operation failed.");
}

function getFormText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new WeddingValidationError(
      "Enter a valid wedding date.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new WeddingValidationError(
      "Enter a valid wedding date.",
    );
  }

  return value;
}

function validateWeddingForm(formData: FormData) {
  const memberId = getFormText(formData, "member_id");
  const spouseSource = getFormText(
    formData,
    "spouse_source",
  ) as WeddingSpouseSource;
  const spouseMemberId = getFormText(
    formData,
    "spouse_member_id",
  );
  const spouseName = getFormText(formData, "spouse_name");
  const churchBranchId = getFormText(
    formData,
    "church_branch_id",
  );
  const officiatedBy = getFormText(
    formData,
    "officiated_by",
  );
  const location = getFormText(formData, "location");
  const certificateNumber = getFormText(
    formData,
    "certificate_number",
  );
  const notes = getFormText(formData, "notes");

  if (!memberId) {
    throw new WeddingValidationError(
      "Select the primary member for this wedding record.",
    );
  }

  if (!churchBranchId) {
    throw new WeddingValidationError(
      "A church branch is required.",
    );
  }

  if (spouseSource !== "member" && spouseSource !== "external") {
    throw new WeddingValidationError(
      "Select how the spouse should be recorded.",
    );
  }

  if (officiatedBy.length > 200) {
    throw new WeddingValidationError(
      "Officiated by must be 200 characters or fewer.",
    );
  }

  if (location.length > 200) {
    throw new WeddingValidationError(
      "Location must be 200 characters or fewer.",
    );
  }

  if (certificateNumber.length > 200) {
    throw new WeddingValidationError(
      "Certificate number must be 200 characters or fewer.",
    );
  }

  if (notes.length > 2000) {
    throw new WeddingValidationError(
      "Notes must be 2,000 characters or fewer.",
    );
  }

  if (spouseSource === "member" && !spouseMemberId) {
    throw new WeddingValidationError(
      "Select the spouse member or choose the external spouse option.",
    );
  }

  if (spouseSource === "external" && !spouseName) {
    throw new WeddingValidationError(
      "Enter the spouse name or choose the existing member option.",
    );
  }

  if (spouseSource === "external" && spouseName.length > 200) {
    throw new WeddingValidationError(
      "Spouse name must be 200 characters or fewer.",
    );
  }

  return {
    member_id: memberId,
    spouse_member_id:
      spouseSource === "member" ? spouseMemberId : null,
    spouse_name: spouseSource === "external" ? spouseName : null,
    wedding_date: validateDate(
      getFormText(formData, "wedding_date"),
    ),
    church_branch_id: churchBranchId,
    officiated_by: officiatedBy || null,
    location: location || null,
    certificate_number: certificateNumber || null,
    notes: notes || null,
  };
}

async function validateMemberForBranch(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string,
  branchId: string,
  allowedHistoricalMemberId: string | null = null,
) {
  const { data, error } = await admin
    .from("members")
    .select("id, church_branch_id, member_status, is_archived")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throwDatabaseFailure("member validation", error);
  }

  if (!data) {
    throw new WeddingValidationError(
      "The selected member could not be found.",
    );
  }

  if (data.church_branch_id !== branchId) {
    throw new WeddingValidationError(
      "The selected member does not belong to the selected branch.",
    );
  }

  const isActive =
    !data.is_archived && data.member_status === "active";

  if (!isActive && memberId !== allowedHistoricalMemberId) {
    throw new WeddingValidationError(
      "Only active members can be linked to a new wedding record.",
    );
  }
}

export async function createWedding(
  _previousState: WeddingActionState,
  formData: FormData,
): Promise<WeddingActionState> {
  const access = await requireWeddingsPermission("weddings.create");
  const admin = createAdminClient();
  let weddingId: string | null = null;

  try {
    const payload = validateWeddingForm(formData);

    await assertActiveWeddingBranch(
      admin,
      access,
      payload.church_branch_id,
    );
    await validateMemberForBranch(
      admin,
      payload.member_id,
      payload.church_branch_id,
    );

    if (payload.spouse_member_id) {
      if (payload.member_id === payload.spouse_member_id) {
        throw new WeddingValidationError(
          "The primary member cannot also be selected as the spouse.",
        );
      }

      await validateMemberForBranch(
        admin,
        payload.spouse_member_id,
        payload.church_branch_id,
      );
    }

    const { data, error } = await admin
      .from("wedding_records")
      .insert({
        ...payload,
        recorded_by: access.user.id,
      })
      .select("id")
      .single();

    if (error) {
      throwDatabaseFailure("creating wedding record", error);
    }

    weddingId = data?.id ?? null;
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The wedding record could not be saved. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(weddingsPath);

  if (weddingId) {
    revalidatePath(`${weddingsPath}/${weddingId}/edit`);
  }

  redirect(weddingsPath);
}

export async function updateWedding(
  weddingId: string,
  _previousState: WeddingActionState,
  formData: FormData,
): Promise<WeddingActionState> {
  const access = await requireWeddingsPermission("weddings.update");
  const admin = createAdminClient();

  try {
    if (!weddingId) {
      throw new WeddingValidationError(
        "A wedding record is required.",
      );
    }

    const payload = validateWeddingForm(formData);
    const { data: existing, error: existingError } = await admin
      .from("wedding_records")
      .select(
        "id, member_id, spouse_member_id, church_branch_id, recorded_by",
      )
      .eq("id", weddingId)
      .maybeSingle();

    if (existingError) {
      throwDatabaseFailure("loading wedding record", existingError);
    }

    if (!existing) {
      throw new WeddingValidationError(
        "The requested wedding record could not be found.",
      );
    }

    await assertActiveWeddingBranch(
      admin,
      access,
      existing.church_branch_id,
    );
    await assertActiveWeddingBranch(
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

    if (payload.spouse_member_id) {
      if (payload.member_id === payload.spouse_member_id) {
        throw new WeddingValidationError(
          "The primary member cannot also be selected as the spouse.",
        );
      }

      await validateMemberForBranch(
        admin,
        payload.spouse_member_id,
        payload.church_branch_id,
        existing.spouse_member_id === payload.spouse_member_id
          ? existing.spouse_member_id
          : null,
      );
    }

    const { error } = await admin
      .from("wedding_records")
      .update({
        ...payload,
        // The original recorder is historical audit data and is never taken
        // from the client during an edit.
        recorded_by: existing.recorded_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", weddingId);

    if (error) {
      throwDatabaseFailure("updating wedding record", error);
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The wedding record could not be updated. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(weddingsPath);
  revalidatePath(`${weddingsPath}/${weddingId}/edit`);

  redirect(weddingsPath);
}
