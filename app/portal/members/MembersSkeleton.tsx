import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function MembersSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-28 rounded-2xl"
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Skeleton className="h-10 flex-1" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
            <Skeleton className="h-10 w-full lg:w-36" />
            <Skeleton className="h-10 w-full lg:w-40" />
            <Skeleton className="h-10 w-full lg:w-40" />
            <Skeleton className="h-10 w-full lg:w-40" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-xl" />

          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-16 w-full rounded-xl"
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-44" />

          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}