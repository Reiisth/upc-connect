import { formText, memberDate } from "@/lib/member-validation";

export function validateChurchMember(form: FormData, { creating = false }: { creating?: boolean } = {}) {
  const allowed = new Set(["first_name", "middle_name", "last_name", "church_branch_id", "first_attendance_date", "member_status", "department_id", "position", "zone"]);
  for (const key of form.keys()) {
    if (!allowed.has(key) && !key.startsWith("$ACTION_")) throw new Error("Only registration identity and church information can be edited here.");
  }
  const first_name = formText(form, "first_name", 120), last_name = formText(form, "last_name", 120);
  if (!first_name || !last_name) throw new Error("First name and last name are required.");
  const church_branch_id = formText(form, "church_branch_id");
  if (!church_branch_id) throw new Error("A church branch is required.");
  const member_status = creating ? "active" : formText(form, "member_status") || "active";
  if (!["active", "inactive"].includes(member_status)) throw new Error("Select a valid administrative member status.");
  const zone = formText(form, "zone");
  if (zone && !/^[1-5]$/.test(zone)) throw new Error("Zone must be between 1 and 5.");
  return { first_name, last_name, middle_name: formText(form, "middle_name", 120) || null, church_branch_id,
    first_attendance_date: memberDate(formText(form, "first_attendance_date"), "First attendance date"),
    member_status, department_id: formText(form, "department_id") || null,
    position: formText(form, "position", 120) || null, zone: zone ? Number(zone) : null };
}
