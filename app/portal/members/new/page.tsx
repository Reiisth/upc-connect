import Link from "next/link";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";

import CreateMemberButton from "./CreateMemberButton";
import { requireMembersPermission } from "../access";
import { createMember } from "../actions";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleActiveBranches } from "../../services/access";

export default function NewMemberPage() {
  return (
    <Suspense fallback={<NewMemberLoading />}>
      <NewMemberContent />
    </Suspense>
  );
}

async function NewMemberContent() {
  const access = await requireMembersPermission("members.create");
  const branches = await getAccessibleActiveBranches(
    access,
    createAdminClient(),
  );

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        backHref="/portal/members"
        backLabel="Back to Members"
        eyebrow="Member Management"
        eyebrowIcon={<UserPlus className="h-4 w-4" />}
        title="Create Member"
        description="Create a basic member record. The member can complete the rest of their profile once their account is connected."
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before creating a member record."
        />
      ) : (
        <form action={createMember}>
          <FormSection
            title="Basic Information"
            description="Enter the member's basic information and assigned branch."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Church Branch"
                htmlFor="church_branch_id"
                required
                className="md:col-span-2"
                description="Only active branches available to your account are listed."
              >
                <Select
                  id="church_branch_id"
                  name="church_branch_id"
                  required
                >
                  <option value="" disabled>
                    Select a church branch
                  </option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.code ? ` (${branch.code})` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="First Name"
                htmlFor="first_name"
                required
              >
                <Input
                  id="first_name"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  placeholder="Enter first name"
                />
              </FormField>

              <FormField
                label="Last Name"
                htmlFor="last_name"
                required
              >
                <Input
                  id="last_name"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  placeholder="Enter last name"
                />
              </FormField>
            </div>

            <FormActions>
              <Button variant="outline" asChild>
                <Link href="/portal/members">
                  Cancel
                </Link>
              </Button>

              <CreateMemberButton />
            </FormActions>
          </FormSection>
        </form>
      )}
    </PageContainer>
  );
}

function NewMemberLoading() {
  return (
    <PageContainer className="max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[360px] rounded-2xl" />
    </PageContainer>
  );
}
