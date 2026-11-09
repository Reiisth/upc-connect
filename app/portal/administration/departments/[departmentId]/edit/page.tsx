import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Network } from "lucide-react";

import { requireAdministrationPermission } from "../../../access";
import { updateDepartment } from "../../actions";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";

export default function EditDepartmentPage(props: { params: Promise<{ departmentId: string }> }) {
  return <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="administration departments edit" />}><EditDepartmentContent {...props} /></Suspense>;
}

async function EditDepartmentContent({ params }: { params: Promise<{ departmentId: string }> }) {
  await requireAdministrationPermission("departments.manage");
  const { departmentId } = await params;
  const { data: department, error } = await createAdminClient().from("departments")
    .select("id, name")
    .eq("id", departmentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load the department.");
  if (!department) notFound();
  const action = updateDepartment.bind(null, department.id);

  return <PageContainer className="max-w-3xl">
    <PageHeader backHref="/portal/administration/departments" backLabel="Back to Church Departments" eyebrow="Church Departments" eyebrowIcon={<Network className="h-4 w-4" />} title="Edit Department" description="Rename this global church department." />
    <form action={action}>
      <FormSection title="Department Information">
        <FormField label="Department Name" htmlFor="name" required>
          <Input id="name" name="name" required maxLength={120} defaultValue={department.name} />
        </FormField>
        <FormActions>
          <Button variant="outline" asChild><Link href="/portal/administration/departments">Cancel</Link></Button>
          <Button type="submit">Save Department</Button>
        </FormActions>
      </FormSection>
    </form>
  </PageContainer>;
}
