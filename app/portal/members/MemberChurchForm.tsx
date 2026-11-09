import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { memberToday } from "@/lib/member-validation";

type Values = { first_name: string; middle_name: string | null; last_name: string; church_branch_id: string | null;
  first_attendance_date: string | null; member_status: string | null; department_id?: string | null; position?: string | null; zone?: number | null };

export function MemberChurchForm({ action, branches, departments = [], member, editing = false, cancelHref = "/portal/members", onCancel, pending = false, embedded = false }: {
  action: (form: FormData) => void | Promise<void>; branches: { id: string; name: string }[];
  departments?: { id: string; name: string; is_active?: boolean }[]; member?: Values; editing?: boolean;
  cancelHref?: string; onCancel?: () => void; pending?: boolean; embedded?: boolean;
}) {
  return <form action={action} className="space-y-6">
    <FormSection className={embedded ? "border-0 p-0 shadow-none" : undefined} title={embedded ? undefined : editing ? "Church Information" : "Member Information"}
      description={editing ? "Update church-controlled information." : "Add a member record. Personal details can be completed after an account is connected."}>
      <fieldset disabled={pending} className="grid gap-5 md:grid-cols-2">
        {!editing && (["first_name", "middle_name", "last_name"] as const).map((key) => <FormField key={key} label={{ first_name: "First Name", middle_name: "Middle Name", last_name: "Last Name" }[key]} htmlFor={key} required={key !== "middle_name"}>
          <Input id={key} name={key} defaultValue={member?.[key] ?? ""} maxLength={120} required={key !== "middle_name"} />
        </FormField>)}
        <FormField label="Church Branch" htmlFor="church_branch_id" required description="Changing branch requires access to both the current and selected branch.">
          <Select id="church_branch_id" name="church_branch_id" defaultValue={member?.church_branch_id ?? ""} required>
            <option value="" disabled>Select a branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </FormField>
        <FormField label="First Attendance Date" htmlFor="first_attendance_date">
          <Input id="first_attendance_date" name="first_attendance_date" type="date" max={memberToday()} defaultValue={member?.first_attendance_date ?? ""} />
        </FormField>
        <FormField label="Department" htmlFor="department_id"><Select id="department_id" name="department_id" defaultValue={member?.department_id ?? ""}>
          <option value="">Not assigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.is_active === false ? " (Inactive; current assignment)" : ""}</option>)}
        </Select></FormField>
        <FormField label="Position" htmlFor="position"><Input id="position" name="position" maxLength={120} defaultValue={member?.position ?? ""} /></FormField>
        <FormField label="Zone" htmlFor="zone"><Select id="zone" name="zone" defaultValue={String(member?.zone ?? "")}>
          <option value="">Not assigned</option>{[1, 2, 3, 4, 5].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </Select></FormField>
        {editing && <FormField label="Member Status" htmlFor="member_status">
          <Select id="member_status" name="member_status" defaultValue={member?.member_status ?? "active"}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </Select>
        </FormField>}
      </fieldset>
      <FormActions>
        {onCancel ? <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button> : <Button variant="outline" asChild><Link href={cancelHref}>Cancel</Link></Button>}
        <Button type="submit" disabled={pending || !branches.length}>{pending ? "Saving..." : editing ? "Save Changes" : "Save Member"}</Button>
      </FormActions>
    </FormSection>
  </form>;
}
