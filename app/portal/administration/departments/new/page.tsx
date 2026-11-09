import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import { Network } from "lucide-react";

import { requireAdministrationPermission } from "../../access";
import { createDepartment } from "../actions";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function NewDepartmentPage() {
  return <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="administration departments new" />}><NewDepartmentContent /></Suspense>;
}

async function NewDepartmentContent() {
  await requireAdministrationPermission("departments.manage");
  return <PageContainer className="max-w-3xl">
    <PageHeader backHref="/portal/administration/departments" backLabel="Back to Church Departments" eyebrow="Church Departments" eyebrowIcon={<Network className="h-4 w-4" />} title="Add Department" description="Add a global church department for Member records." />
    <form action={createDepartment}>
      <FormSection title="Department Information" description="Department names are shared across all church branches.">
        <FormField label="Department Name" htmlFor="name" required>
          <Input id="name" name="name" required maxLength={120} placeholder="e.g. Youth" />
        </FormField>
        <FormActions>
          <Button variant="outline" asChild><Link href="/portal/administration/departments">Cancel</Link></Button>
          <Button type="submit">Add Department</Button>
        </FormActions>
      </FormSection>
    </form>
  </PageContainer>;
}
