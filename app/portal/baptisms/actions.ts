"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import { assertActiveServiceBranch } from "../services/access";
import { requireBaptismManager } from "./access";
import {
  BAPTISM_TYPES,
  formatBaptismType,
  type BaptismActionState,
  type BaptismType,
} from "./types";

const baptismsPath = "/portal/baptisms";

class BaptismValidationError extends Error {}

const safeBranchAccessErrors = new Set([
  "A church branch is required.",
  "You can only use church branches assigned to your account.",
  "The selected church branch does not exist or is inactive.",
]);

function getActionErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof BaptismValidationError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    safeBranchAccessErrors.has(error.message)
  ) {
    return error.message;
  }

  console.error("Baptism action failed", error);
  return fallback;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function throwDatabaseFailure(
  context: string,
  error: unknown,
): never {
  console.error(`Baptism database failure: ${context}`, error);

  if (isUniqueViolation(error)) {
    throw new BaptismValidationError(
      "This member already has a baptism record of that type.",
    );
  }

  throw new Error("Baptism database operation failed.");
}

function getFormText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateDate(value: string) {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BaptismValidationError(
      "Enter a valid baptism date or leave it blank if the date is unknown.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BaptismValidationError(
      "Enter a valid baptism date or leave it blank if the date is unknown.",
    );
  }

  return value;
}

function validateBaptismForm(formData: FormData) {
  const memberId = getFormText(formData, "member_id");
  const baptismType = getFormText(
    formData,
    "baptism_type",
  ) as BaptismType;
  const churchBranchId = getFormText(
    formData,
    "church_branch_id",
  );
  const officiatedBy = getFormText(
    formData,
    "officiated_by",
  );
  const location = getFormText(formData, "location");
  const notes = getFormText(formData, "notes");

  if (!memberId) {
    throw new BaptismValidationError(
      "Select a member for this baptism record.",
    );
  }

  if (!BAPTISM_TYPES.includes(baptismType)) {
    throw new BaptismValidationError(
      "Select a valid baptism type.",
    );
  }

  if (!churchBranchId) {
    throw new BaptismValidationError(
      "A church branch is required.",
    );
  }

  if (officiatedBy.length > 200) {
    throw new BaptismValidationError(
      "Officiated by must be 200 characters or fewer.",
    );
  }

  if (location.length > 200) {
    throw new BaptismValidationError(
      "Location must be 200 characters or fewer.",
    );
  }

  if (notes.length > 2000) {
    throw new BaptismValidationError(
      "Notes must be 2,000 characters or fewer.",
    );
  }

  return {
    member_id: memberId,
    baptism_type: baptismType,
    baptism_date: validateDate(
      getFormText(formData, "baptism_date"),
    ),
    church_branch_id: churchBranchId,
    officiated_by: officiatedBy || null,
    location: location || null,
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
    .select(
      "id, church_branch_id, member_status, is_archived",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throwDatabaseFailure("member validation", error);
  }

  if (!data) {
    throw new BaptismValidationError(
      "The selected member could not be found.",
    );
  }

  if (data.church_branch_id !== branchId) {
    throw new BaptismValidationError(
      "The selected member does not belong to the selected branch.",
    );
  }

  const isActive =
    !data.is_archived && data.member_status === "active";

  if (!isActive && memberId !== allowedHistoricalMemberId) {
    throw new BaptismValidationError(
      "Only active members can be linked to a new baptism record.",
    );
  }
}

async function validateUniqueBaptism(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string,
  baptismType: BaptismType,
  excludedId: string | null = null,
) {
  const baseQuery = admin
    .from("baptism_records")
    .select("id")
    .eq("member_id", memberId)
    .eq("baptism_type", baptismType);

  const result = excludedId
    ? await baseQuery.neq("id", excludedId).maybeSingle()
    : await baseQuery.maybeSingle();

  if (result.error) {
    throwDatabaseFailure("duplicate validation", result.error);
  }

  if (result.data) {
    throw new BaptismValidationError(
      `This member already has a ${formatBaptismType(baptismType).toLowerCase()} baptism record.`,
    );
  }
}

export async function createBaptism(
  _previousState: BaptismActionState,
  formData: FormData,
): Promise<BaptismActionState> {
  const access = await requireBaptismManager();
  const admin = createAdminClient();
  let baptismId: string | null = null;

  try {
    const payload = validateBaptismForm(formData);

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
    await validateUniqueBaptism(
      admin,
      payload.member_id,
      payload.baptism_type,
    );

    const { data, error } = await admin
      .from("baptism_records")
      .insert({
        ...payload,
        recorded_by: access.user.id,
      })
      .select("id")
      .single();

    if (error) {
      throwDatabaseFailure("creating baptism record", error);
    }

    baptismId = data?.id ?? null;
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The baptism record could not be saved. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(baptismsPath);

  if (baptismId) {
    revalidatePath(`${baptismsPath}/${baptismId}/edit`);
  }

  redirect(baptismsPath);
}

export async function updateBaptism(
  baptismId: string,
  _previousState: BaptismActionState,
  formData: FormData,
): Promise<BaptismActionState> {
  const access = await requireBaptismManager();
  const admin = createAdminClient();

  try {
    if (!baptismId) {
      throw new BaptismValidationError(
        "A baptism record is required.",
      );
    }

    const payload = validateBaptismForm(formData);
    const { data: existing, error: existingError } = await admin
      .from("baptism_records")
      .select(
        "id, member_id, baptism_type, church_branch_id, recorded_by",
      )
      .eq("id", baptismId)
      .maybeSingle();

    if (existingError) {
      throwDatabaseFailure("loading baptism record", existingError);
    }

    if (!existing) {
      throw new BaptismValidationError(
        "The requested baptism record could not be found.",
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
    await validateUniqueBaptism(
      admin,
      payload.member_id,
      payload.baptism_type,
      baptismId,
    );

    const { error } = await admin
      .from("baptism_records")
      .update({
        ...payload,
        // Preserve the original recorder for historical audit data. Legacy
        // rows without a recorder use the current authenticated user.
        recorded_by: existing.recorded_by ?? access.user.id,
      })
      .eq("id", baptismId);

    if (error) {
      throwDatabaseFailure("updating baptism record", error);
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "The baptism record could not be updated. Please review the form and try again.",
      ),
    };
  }

  revalidatePath(baptismsPath);
  revalidatePath(`${baptismsPath}/${baptismId}/edit`);

  redirect(baptismsPath);
}
