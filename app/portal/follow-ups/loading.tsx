import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function FollowUpsLoading() {
  return <PageContainer><div role="status" aria-label="Loading follow-ups" className="space-y-3">
    <Skeleton className="h-4 w-36" /><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" />
  </div><Skeleton className="h-28 w-full" /><Skeleton className="h-96 w-full" /></PageContainer>;
}
