import { Suspense } from "react";
import { UserRound } from "lucide-react";
import { requireActiveAccount } from "@/lib/auth";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { FormSection } from "@/components/ui/form-section";
import { Skeleton } from "@/components/ui/skeleton";
import ChangePasswordForm from "./ChangePasswordForm";

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
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

function AccountSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <FormSection>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </FormSection>
      <FormSection>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="max-w-xl space-y-5">
          {[0, 1, 2].map((field) => <div key={field} className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>)}
          <Skeleton className="h-10 w-40" />
        </div>
      </FormSection>
    </PageContainer>
  );
}
