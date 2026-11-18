import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";

import { requireActiveAccount } from "@/lib/auth";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { FormSection } from "@/components/ui/form-section";
import ChangePasswordForm from "./ChangePasswordForm";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton showHeader={false} kind="detail" fields={3} metrics={0} columns={5} label="account" />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  "use cache: private";
  cacheLife({ stale: 120 });
  cacheTag("portal:account");
  const { user } = await requireActiveAccount();

  return (
    <PageContainer>
      <PageHeader variant="overview"
        title="My Account"  />
      <FormSection title="Account Information">
        <dl>
          <dt className="text-sm font-medium text-slate-700">Email</dt>
          <dd className="mt-1 break-words text-sm text-[#203264]">
            {user.email ?? "No email available"}
          </dd>
        </dl>
      </FormSection>
      <FormSection title="Security" description="Change your password to keep your account secure.">
        <ChangePasswordForm />
      </FormSection>
    </PageContainer>
  );
}
