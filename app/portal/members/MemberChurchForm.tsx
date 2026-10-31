import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { memberToday } from "@/lib/member-validation";

type Values = { first_name: string; middle_name: string | null; last_name: string; church_branch_id: string | null;
  first_attendance_date: string | null; member_status: string | null; department_id?: string | null; position?: string | null; zone?: number | null };

export function MemberChurchForm({ action, branches, departments = [], member, editing = false }: {
  action: (form: FormData) => Promise<void>; branches: { id: string; name: string }[];
  departments?: { id: string; name: string }[]; member?: Values; editing?: boolean;
}) {
  return <form action={action} className="space-y-6">
    <FormSection title={editing ? "Registration and Church Information" : "Register Member"}
      description="Staff maintain registration names and church records. Personal/contact profile fields are maintained separately by the linked account.">
      <div className="grid gap-5 md:grid-cols-2">
        {(["first_name", "middle_name", "last_name"] as const).map((key) => <FormField key={key} label={key.replace("_", " ")} htmlFor={key} required={key !== "middle_name"}>
          <Input id={key} name={key} defaultValue={member?.[key] ?? ""} maxLength={120} required={key !== "middle_name"} />
        </FormField>)}
        <FormField label="Church Branch" htmlFor="church_branch_id" required description="Changing branch requires access to both the current and selected branch.">
          <Select id="church_branch_id" name="church_branch_id" defaultValue={member?.church_branch_id ?? ""} required>
            <option value="" disabled>Select a branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </FormField>
        <FormField label="First Attendance Date" htmlFor="first_attendance_date" description="Leave blank when unknown. Inactivity needs this date to establish eligibility.">
          <Input id="first_attendance_date" name="first_attendance_date" type="date" max={memberToday()} defaultValue={member?.first_attendance_date ?? ""} />
        </FormField>
        <FormField label="Administrative Member Status" htmlFor="member_status" description="Stored status is separate from calculated inactivity.">
          <Select id="member_status" name="member_status" defaultValue={member?.member_status ?? "active"}>
            <option value="active">Active (administrative)</option><option value="inactive">Inactive (administrative)</option>
          </Select>
        </FormField>
        {editing && <>
          <FormField label="Department" htmlFor="department_id"><Select id="department_id" name="department_id" defaultValue={member?.department_id ?? ""}>
            <option value="">None</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select></FormField>
          <FormField label="Ministry Position" htmlFor="position"><Input id="position" name="position" maxLength={120} defaultValue={member?.position ?? ""} /></FormField>
          <FormField label="Church Zone" htmlFor="zone"><Select id="zone" name="zone" defaultValue={String(member?.zone ?? "")}>
            <option value="">Unassigned</option>{[1, 2, 3, 4, 5].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </Select></FormField>
        </>}
      </div>
      <FormActions><Button type="submit" disabled={!branches.length}>{editing ? "Save Member" : "Create Member"}</Button></FormActions>
    </FormSection>
  </form>;
}
