"use server";

import { isProfileDefinition, isReservedMemberField } from "@/lib/member-field-policy";

import { PROFILE_FIELD_DEFAULTS } from "@/lib/profile-field-defaults";

import { revalidatePortalPath as revalidatePath } from "@/lib/portal-invalidation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrationPermission } from "@/app/portal/administration/access";

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

export async function restoreDefaultFieldConfiguration() {
  await requireAdministrationPermission("administration.view");

  const admin = createAdminClient();

  const defaults = PROFILE_FIELD_DEFAULTS;

  for (const field of defaults) {
    if (!isProfileDefinition({ ...field, is_builtin: true })) continue;
    const { error } = await admin
      .from("member_field_definitions")
      .update({
        label: field.label,
        field_type: field.field_type,
        field_group: field.field_group,
        is_required: field.is_required,
        is_visible: field.is_visible,
        placeholder: field.placeholder,
        options_source: field.options_source,
        options: field.options,
        sort_order: field.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("field_key", field.field_key)
      .eq("is_builtin", true);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/portal/administration/profile-fields");
  revalidatePath("/portal/profile", "layout");
}

export async function saveFieldConfiguration(
  fields: FieldUpdate[],
) {
  await requireAdministrationPermission("administration.view");

  const admin = createAdminClient();
  const { data: existingFields, error: definitionError } = await admin.from("member_field_definitions")
    .select("id, field_key, field_type, is_builtin");
  if (definitionError) throw new Error("Unable to verify field definitions.");
  const known = new Map((existingFields ?? []).map((field) => [field.id, field]));
  if (!Array.isArray(fields)) throw new Error("Invalid field configuration.");
  for (const field of fields) {
    if (!field || typeof field.id !== "string" || typeof field.field_key !== "string" ||
        typeof field.label !== "string" || !field.label.trim() || field.label.length > 120 ||
        !["text", "textarea", "number", "date", "email", "phone", "select", "checkbox"].includes(field.field_type) ||
        typeof field.is_required !== "boolean" || typeof field.is_visible !== "boolean" ||
        !Number.isInteger(field.sort_order) || !/^[a-z][a-z0-9_]*$/.test(field.field_key)) throw new Error("Invalid field configuration.");
    const existing = known.get(field.id);
    if (field.id.startsWith("new-")) {
      if (isReservedMemberField(field.field_key)) throw new Error("Church and system fields cannot be configured as custom profile fields.");
    } else if (!existing || existing.field_key !== field.field_key || !isProfileDefinition(existing)) {
      throw new Error("This field is not a configurable personal profile field.");
    } else if (existing.is_builtin && existing.field_type !== field.field_type) {
      throw new Error("Built-in profile field types cannot be changed.");
    }
    if (field.options_source && !["custom", "departments", "church_branches"].includes(field.options_source)) throw new Error("Invalid option source.");
  }


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

  revalidatePath("/portal/administration/profile-fields");
  revalidatePath("/portal/profile", "layout");
}

export async function deleteCustomField(fieldId: string) {
  await requireAdministrationPermission("administration.view");

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

  revalidatePath("/portal/administration/profile-fields");
  revalidatePath("/portal/profile", "layout");
}
