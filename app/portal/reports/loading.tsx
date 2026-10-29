import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return <PageContainer>
    <div role="status" aria-label="Loading reports" className="space-y-3">
      <Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-80 max-w-full" /><Skeleton className="h-4 w-[36rem] max-w-full" />
    </div>
    <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <Card key={item}><CardContent className="space-y-3 p-5">
      <Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-40" />
    </CardContent></Card>)}</div>
    <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
  </PageContainer>;
}
