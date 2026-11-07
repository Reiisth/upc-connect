import { parsePhoneNumberFromString } from "libphonenumber-js";
import { isProfileDefinition, isSelfServiceField, SELF_SERVICE_FIELDS, type MemberFieldDefinition } from "./member-field-policy";

export function memberToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function memberDate(value: string, label: string, { future = false, today = memberToday() } = {}) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) throw new Error(`${label} must be a valid calendar date.`);
  const instant = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid calendar date.`);
  if (!future && value > today) throw new Error(`${label} cannot be in the future.`);
  return value;
}

export function formText(form: FormData, key: string, max = 250): string {
  const entries = form.getAll(key);
  if (entries.length > 1 || entries.some((value) => typeof value !== "string")) throw new Error(`Invalid ${key}.`);
  const value = String(entries[0] ?? "").trim();
  if (value.length > max) throw new Error(`${key} must be ${max} characters or fewer.`);
  return value;
}

export type ProfileOptions = { departments: string[]; branches: string[] };
const defaultTypes: Record<string, string> = { birth_date: "date", wedding_anniversary: "date", phone_number: "phone", gender: "select", civil_status: "select" };

function configuredOptions(field: MemberFieldDefinition, catalog: ProfileOptions): string[] {
  switch (field.options_source || "custom") {
    case "custom": return Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [];
    case "departments": return catalog.departments;
    case "church_branches": return catalog.branches;
    default: throw new Error(`Unsupported option source for ${field.label}.`);
  }
}

function fieldValue(raw: string, field: MemberFieldDefinition, catalog: ProfileOptions): string | number | boolean | null {
  if (!raw) return field.field_type === "checkbox" ? false : null;
  switch (field.field_type) {
    case "number": {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(Number(raw))) throw new Error(`${field.label} must be a valid number.`);
      return Number(raw);
    }
    case "date": return memberDate(raw, field.label, { future: !field.is_builtin });
    case "email": if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error(`${field.label} must be a valid email.`); return raw.toLowerCase();
    case "phone": {
      const phone = parsePhoneNumberFromString(raw.startsWith("09") ? `+63${raw.slice(1)}` : raw);
      if (!phone?.isValid()) throw new Error(`${field.label} must be a valid phone number.`);
      return phone.number;
    }
    case "select": {
      const normalize = field.is_builtin && ["gender", "civil_status"].includes(field.field_key);
      const choices = configuredOptions(field, catalog).map((value) => normalize ? value.toLowerCase() : value);
      const value = normalize ? raw.toLowerCase() : raw;
      if (!choices.includes(value)) throw new Error(`Select a valid ${field.label}.`);
      return value;
    }
    case "checkbox": if (!["true", "false", "on"].includes(raw)) throw new Error(`${field.label} must be a checkbox value.`); return raw !== "false";
    case "text": case "textarea": return raw;
    default: throw new Error(`Unsupported field type for ${field.label}.`);
  }
}

/** Validate every submitted field before either base or supplemental writes. */
export function validateSelfServiceProfile(form: FormData, definitions: MemberFieldDefinition[], current: Record<string, unknown>, catalog: ProfileOptions, accountEmail: string) {
  const fields = definitions.filter(isProfileDefinition);
  const custom = fields.filter((field) => !field.is_builtin && field.is_visible);
  const customByName = new Map(custom.map((field) => [`custom_field_${field.id}`, field]));
  for (const key of form.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    if (key === "email") { if (formText(form, key) !== accountEmail) throw new Error("Account email is managed through account connection."); continue; }
    if (key.startsWith("custom_field_")) { if (!customByName.has(key)) throw new Error("Unknown or unavailable custom field."); }
    else if (!isSelfServiceField(key)) throw new Error("Church and system information cannot be changed through Profile.");
    else if (fields.some((field) => field.is_builtin && field.field_key === key && !field.is_visible)) throw new Error("A hidden profile field cannot be changed.");
  }
  const patch: Record<string, string | number | boolean | null> = {};
  const effective = { ...current };
  for (const key of SELF_SERVICE_FIELDS) {
    const configured = fields.find((field) => field.is_builtin && field.field_key === key);
    if (configured?.is_visible === false) continue;
    if (!form.has(key)) continue;
    const definition = configured ?? { id: key, field_key: key, label: key, field_type: defaultTypes[key] ?? "text", is_builtin: true, is_visible: true, is_required: false, options_source: "custom", options: key === "gender" ? ["male", "female"] : key === "civil_status" ? ["single", "married", "widowed", "separated", "divorced"] : null, sort_order: 0 };
    const raw = formText(form, key, key.includes("name") ? 120 : key === "phone_number" ? 40 : 250);
    patch[key] = fieldValue(raw, definition, catalog);
    effective[key] = patch[key];
  }
  if (!String(effective.first_name ?? "").trim() || !String(effective.last_name ?? "").trim()) throw new Error("First name and last name are required.");
  if (effective.civil_status && !["single", "married", "widowed", "separated", "divorced"].includes(String(effective.civil_status))) throw new Error("Select a valid civil status.");
  if (form.has("civil_status") && !["married", "widowed"].includes(String(effective.civil_status))) { patch.wedding_anniversary = null; effective.wedding_anniversary = null; }
  for (const field of fields.filter((field) => field.is_builtin && field.is_visible && field.is_required && field.field_key !== "email")) {
    if (field.field_key === "wedding_anniversary" && !["married", "widowed"].includes(String(effective.civil_status))) continue;
    if (!String(effective[field.field_key] ?? "").trim()) throw new Error(`${field.label} is required.`);
    fieldValue(String(effective[field.field_key]), field, catalog);
  }
  const values = custom.map((field) => {
    const name = `custom_field_${field.id}`;
    const raw = formText(form, name, field.field_type === "textarea" ? 2000 : 500);
    if (field.is_required && (!raw || field.field_type === "checkbox" && !["true", "on"].includes(raw))) throw new Error(`${field.label} is required.`);
    return { field_definition_id: field.id, value: fieldValue(raw, field, catalog) };
  });
  return { patch, values };
}
