import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";

import { createBranch } from "../actions";
import { requirePortalTab } from "@/lib/require-portal-tab";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewBranchPage() {
  return (
    <Suspense fallback={<NewBranchLoading />}>
      <NewBranchContent />
    </Suspense>
  );
}

async function NewBranchContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <PageContainer>
        <EmptyState
          title="Access denied"
          description="You do not have permission to create church branches."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration/branches"
        backLabel="Back to Church Branches"
        eyebrow="Branch Management"
        eyebrowIcon={<Building2 className="h-4 w-4" />}
        title="Create Church Branch"
        description="Add a new church branch to UPC Connect."
      />

      <form action={createBranch}>
        <FormSection
          title="Branch Information"
          description="Enter the branch name, code, and location details."
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
                placeholder="e.g. UPC Batangas Main"
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
                placeholder="e.g. MAIN"
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
                defaultValue="Philippines"
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
                placeholder="Street / Sitio / Purok"
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
              Create Branch
            </Button>
          </FormActions>
        </FormSection>
      </form>
    </PageContainer>
  );
}

function NewBranchLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-[430px] rounded-2xl" />
    </PageContainer>
  );
}