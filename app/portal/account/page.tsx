import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { UserRound } from "lucide-react";
import { requireActiveAccount } from "@/lib/auth";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { FormSection } from "@/components/ui/form-section";
import ChangePasswordForm from "./ChangePasswordForm";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="detail" fields={3} metrics={0} columns={5} label="account" />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const { user } = await requireActiveAccount();

  return (
    <PageContainer>
      <PageHeader eyebrow="Account" eyebrowIcon={<UserRound className="h-4 w-4" />}
        title="My Account" description="Manage your login and account security." />
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
