import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function InactivityLoading() {
  return (
    <PageContainer>
      <div className="space-y-2" role="status" aria-label="Loading inactivity monitoring">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((index) => <Card key={index}><CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-36" /><Skeleton className="h-28 w-full" />
        </CardContent></Card>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => <Card key={index}><CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-16" />
        </CardContent></Card>)}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
}
