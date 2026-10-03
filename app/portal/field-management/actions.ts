"use server";

import { revalidatePath } from "next/cache";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

type FieldUpdate = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  is_visible: boolean;
  placeholder: string | null;
  options_source: string | null;
  options: unknown;
  sort_order: number;
};

export async function saveFieldConfiguration(
  fields: FieldUpdate[],
) {
  await requirePortalTab("field_management");

  const admin = createAdminClient();

  for (const field of fields) {
    if (
      field.field_type === "select" &&
      field.options_source === "custom"
    ) {
      const options = Array.isArray(field.options)
        ? field.options.filter(
          (option): option is string =>
            typeof option === "string" &&
            option.trim().length > 0,
        )
        : [];

      if (options.length === 0) {
        throw new Error(
          `${field.label} must have at least one custom option.`,
        );
      }
    }
  }

  for (const field of fields) {
    const payload = {
      field_key: field.field_key,
      label: field.label.trim(),
      field_type: field.field_type,
      is_builtin: false,
      is_required: field.is_required,
      is_visible: field.is_visible,
      placeholder:
        field.placeholder?.trim() || null,
      options_source: field.options_source,
      options: field.options,
      sort_order: field.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (field.id.startsWith("new-")) {
      const { error } = await admin
        .from("member_field_definitions")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await admin
        .from("member_field_definitions")
        .update({
          label: payload.label,
          field_type: payload.field_type,
          is_required: payload.is_required,
          is_visible: payload.is_visible,
          placeholder: payload.placeholder,
          options_source: payload.options_source,
          options: payload.options,
          sort_order: payload.sort_order,
          updated_at: payload.updated_at,
        })
        .eq("id", field.id);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  revalidatePath("/portal/field-management");
  revalidatePath("/portal/profile");
}

export async function deleteCustomField(fieldId: string) {
  await requirePortalTab("field_management");

  const admin = createAdminClient();

  const { data: field, error: fetchError } = await admin
    .from("member_field_definitions")
    .select("id, is_builtin")
    .eq("id", fieldId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (field.is_builtin) {
    throw new Error("Built-in fields cannot be deleted.");
  }

  const { error: deleteError } = await admin
    .from("member_field_definitions")
    .delete()
    .eq("id", fieldId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/portal/field-management");
  revalidatePath("/portal/profile");
}