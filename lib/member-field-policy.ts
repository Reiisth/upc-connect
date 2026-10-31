export const SELF_SERVICE_FIELDS = [
  "first_name", "middle_name", "last_name", "nickname", "birth_date", "gender",
  "civil_status", "phone_number", "street_address", "barangay", "city", "province",
  "region", "country", "wedding_anniversary",
] as const;

export const CHURCH_MANAGED_FIELDS = [
  "church_branch_id", "first_attendance_date", "member_status", "department_id",
  "position", "zone", "is_archived", "archived_at",
] as const;

const reservedFields = new Set<string>([
  ...SELF_SERVICE_FIELDS, ...CHURCH_MANAGED_FIELDS, "id", "email", "photo_url", "department",
  "account_status", "profile_status", "invited_at", "invited_by", "accepted_at",
  "profile_completed_at", "created_at", "updated_at", "user_id", "role", "role_id",
  "roles", "system_role", "account_members",
]);

export type MemberFieldDefinition = {
  id: string; field_key: string; label: string; field_type: string;
  field_group?: string | null; is_builtin: boolean; is_required: boolean; is_visible: boolean;
  options_source: string | null; options: unknown; sort_order: number;
};

export function isSelfServiceField(key: string) {
  return (SELF_SERVICE_FIELDS as readonly string[]).includes(key);
}

export function isReservedMemberField(key: string) {
  return reservedFields.has(key);
}

export function isProfileDefinition(field: Pick<MemberFieldDefinition, "field_key" | "is_builtin">) {
  return field.is_builtin
    ? isSelfServiceField(field.field_key) || field.field_key === "email"
    : !isReservedMemberField(field.field_key);
}
