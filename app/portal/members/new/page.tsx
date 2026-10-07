import Link from "next/link";
import { UserPlus } from "lucide-react";

import CreateMemberButton from "./CreateMemberButton";
import { createMember } from "../actions";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function NewMemberPage() {
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

      <form action={createMember}>
        <FormSection
          title="Basic Information"
          description="Enter the member's basic information to create their record."
        >
          <div className="grid gap-5 md:grid-cols-2">
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
    </PageContainer>
  );
}