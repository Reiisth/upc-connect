"use server";

import { revalidatePath } from "next/cache";

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

  const defaults = [
    // PERSONAL INFORMATION
    {
      field_key: "first_name",
      label: "First Name",
      field_type: "text",
      field_group: "personal",
      is_required: true,
      is_visible: true,
      placeholder: "Enter first name",
      options_source: null,
      options: null,
      sort_order: 1,
    },
    {
      field_key: "middle_name",
      label: "Middle Name",
      field_type: "text",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Enter middle name",
      options_source: null,
      options: null,
      sort_order: 2,
    },
    {
      field_key: "last_name",
      label: "Last Name",
      field_type: "text",
      field_group: "personal",
      is_required: true,
      is_visible: true,
      placeholder: "Enter last name",
      options_source: null,
      options: null,
      sort_order: 3,
    },
    {
      field_key: "nickname",
      label: "Nickname",
      field_type: "text",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Enter nickname",
      options_source: null,
      options: null,
      sort_order: 4,
    },
    {
      field_key: "birth_date",
      label: "Birthday",
      field_type: "date",
      field_group: "personal",
      is_required: true,
      is_visible: true,
      placeholder: null,
      options_source: null,
      options: null,
      sort_order: 5,
    },
    {
      field_key: "gender",
      label: "Gender",
      field_type: "select",
      field_group: "personal",
      is_required: true,
      is_visible: true,
      placeholder: "Select gender",
      options_source: "custom",
      options: ["Male", "Female"],
      sort_order: 6,
    },
    {
      field_key: "civil_status",
      label: "Civil Status",
      field_type: "select",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Select civil status",
      options_source: "custom",
      options: [
        "Single",
        "Married",
        "Widowed",
        "Separated",
      ],
      sort_order: 7,
    },
    {
      field_key: "zone",
      label: "Zone",
      field_type: "select",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Select zone",
      options_source: "custom",
      options: ["1", "2", "3", "4", "5"],
      sort_order: 8,
    },
    {
      field_key: "phone_number",
      label: "Mobile Number",
      field_type: "phone",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Enter mobile number",
      options_source: null,
      options: null,
      sort_order: 9,
    },
    {
      field_key: "email",
      label: "Email",
      field_type: "email",
      field_group: "personal",
      is_required: false,
      is_visible: true,
      placeholder: "Enter email address",
      options_source: null,
      options: null,
      sort_order: 10,
    },

    // ADDRESS
    {
      field_key: "country",
      label: "Country",
      field_type: "text",
      field_group: "address",
      is_required: true,
      is_visible: true,
      placeholder: "Enter country",
      options_source: null,
      options: null,
      sort_order: 1,
    },
    {
      field_key: "street_address",
      label: "Street Address",
      field_type: "text",
      field_group: "address",
      is_required: false,
      is_visible: true,
      placeholder: "Enter street address",
      options_source: null,
      options: null,
      sort_order: 2,
    },
    {
      field_key: "region",
      label: "Region",
      field_type: "select",
      field_group: "address",
      is_required: true,
      is_visible: true,
      placeholder: "Select region",
      options_source: "psgc_regions",
      options: null,
      sort_order: 3,
    },
    {
      field_key: "province",
      label: "Province",
      field_type: "text",
      field_group: "address",
      is_required: true,
      is_visible: true,
      placeholder: "Enter province",
      options_source: null,
      options: null,
      sort_order: 4,
    },
    {
      field_key: "city",
      label: "City / Municipality",
      field_type: "text",
      field_group: "address",
      is_required: true,
      is_visible: true,
      placeholder: "Enter city or municipality",
      options_source: null,
      options: null,
      sort_order: 5,
    },
    {
      field_key: "barangay",
      label: "Barangay",
      field_type: "text",
      field_group: "address",
      is_required: true,
      is_visible: true,
      placeholder: "Enter barangay",
      options_source: null,
      options: null,
      sort_order: 6,
    },

    // CHURCH INFORMATION
    {
      field_key: "church_branch_id",
      label: "Church Branch",
      field_type: "select",
      field_group: "church",
      is_required: true,
      is_visible: true,
      placeholder: "Select church branch",
      options_source: "church_branches",
      options: null,
      sort_order: 1,
    },
    {
      field_key: "department_id",
      label: "Department",
      field_type: "select",
      field_group: "church",
      is_required: false,
      is_visible: true,
      placeholder: "Select department",
      options_source: "departments",
      options: null,
      sort_order: 2,
    },
    {
      field_key: "position",
      label: "Position",
      field_type: "text",
      field_group: "church",
      is_required: false,
      is_visible: true,
      placeholder: "Enter position",
      options_source: null,
      options: null,
      sort_order: 3,
    },
    {
      field_key: "first_attendance_date",
      label: "First Date of Attendance",
      field_type: "date",
      field_group: "church",
      is_required: false,
      is_visible: true,
      placeholder: null,
      options_source: null,
      options: null,
      sort_order: 4,
    },
    {
      field_key: "wedding_anniversary",
      label: "Wedding Anniversary",
      field_type: "date",
      field_group: "church",
      is_required: false,
      is_visible: true,
      placeholder: null,
      options_source: null,
      options: null,
      sort_order: 5,
    },

    // CURRENTLY NOT RENDERED AS A NORMAL FORM FIELD
    {
      field_key: "photo_url",
      label: "Profile Photo",
      field_type: "text",
      field_group: "personal",
      is_required: false,
      is_visible: false,
      placeholder: null,
      options_source: null,
      options: null,
      sort_order: 11,
    },
  ];

  for (const field of defaults) {
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

  revalidatePath("/portal/field-management");
  revalidatePath("/portal/profile");
}

export async function saveFieldConfiguration(
  fields: FieldUpdate[],
) {
  await requireAdministrationPermission("administration.view");

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

  revalidatePath("/portal/field-management");
  revalidatePath("/portal/profile");
}
