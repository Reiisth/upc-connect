import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";

import { updateBranch } from "./../../actions";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type EditBranchPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

export default function EditBranchPage(
  props: EditBranchPageProps,
) {
  return (
    <Suspense fallback={<EditBranchLoading />}>
      <EditBranchContent {...props} />
    </Suspense>
  );
}

async function EditBranchContent({
  params,
}: EditBranchPageProps) {
  const { branchId } = await params;

  const { roles } = await requirePortalTab(
    "administration",
  );

  if (!roles.includes("system_admin")) {
    return (
      <PageContainer>
        <EmptyState
          title="Access denied"
          description="You do not have permission to edit church branches."
        />
      </PageContainer>
    );
  }

  const admin = createAdminClient();

  const { data: branch, error } = await admin
    .from("church_branches")
    .select(`
      id,
      name,
      code,
      street_address,
      barangay,
      city,
      province,
      country
    `)
    .eq("id", branchId)
    .single();

  if (error || !branch) {
    notFound();
  }

  const updateBranchAction = updateBranch.bind(
    null,
    branch.id,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration/branches"
        backLabel="Back to Church Branches"
        eyebrow="Branch Management"
        eyebrowIcon={<Building2 className="h-4 w-4" />}
        title="Edit Church Branch"
        description={`Update the information for ${branch.name}.`}
      />

      <form action={updateBranchAction}>
        <FormSection
          title="Branch Information"
          description="Update the branch name, code, and location details."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Branch Name"
              htmlFor="name"
              required
              className="md:col-span-2"
            >
              <Input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={branch.name}
              />
            </FormField>

            <FormField
              label="Branch Code"
              htmlFor="code"
              required
              description="Use a short unique code such as MAIN or LEMERY."
            >
              <Input
                id="code"
                name="code"
                type="text"
                required
                defaultValue={branch.code ?? ""}
                className="uppercase"
              />
            </FormField>

            <FormField
              label="Country"
              htmlFor="country"
            >
              <Input
                id="country"
                name="country"
                type="text"
                defaultValue={branch.country ?? ""}
              />
            </FormField>

            <FormField
              label="Street Address"
              htmlFor="street_address"
              className="md:col-span-2"
            >
              <Input
                id="street_address"
                name="street_address"
                type="text"
                defaultValue={branch.street_address ?? ""}
              />
            </FormField>

            <FormField
              label="Barangay"
              htmlFor="barangay"
            >
              <Input
                id="barangay"
                name="barangay"
                type="text"
                defaultValue={branch.barangay ?? ""}
              />
            </FormField>

            <FormField
              label="City / Municipality"
              htmlFor="city"
            >
              <Input
                id="city"
                name="city"
                type="text"
                defaultValue={branch.city ?? ""}
              />
            </FormField>

            <FormField
              label="Province"
              htmlFor="province"
            >
              <Input
                id="province"
                name="province"
                type="text"
                defaultValue={branch.province ?? ""}
              />
            </FormField>
          </div>

          <FormActions>
            <Button variant="outline" asChild>
              <Link href="/portal/administration/branches">
                Cancel
              </Link>
            </Button>

            <Button type="submit">
              Save Changes
            </Button>
          </FormActions>
        </FormSection>
      </form>
    </PageContainer>
  );
}

function EditBranchLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-[430px] rounded-2xl" />
    </PageContainer>
  );
}