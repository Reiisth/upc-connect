import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-52" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-full min-h-[150px] w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:min-h-[190px]"
          >
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Skeleton className="h-14 w-14 rounded-full sm:h-20 sm:w-20" />

              <Skeleton className="mt-3 h-4 w-24 sm:h-5 sm:w-28" />

              <Skeleton className="mt-2 h-5 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}