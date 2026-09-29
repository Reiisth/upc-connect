import { createAdminClient } from "@/lib/supabase/admin";

export async function getMemberFieldDefinitions() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("member_field_definitions")
    .select(`
      id,
      field_key,
      label,
      field_type,
      is_builtin,
      is_required,
      is_visible,
      options,
      sort_order
    `)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}