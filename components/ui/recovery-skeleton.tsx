import { Card, CardContent } from "./card";
import { RecoveryLayout } from "./recovery-layout";
import { Skeleton } from "./skeleton";

export function RecoverySkeleton({ fields, label }: { fields: number; label: string }) {
  return (
    <RecoveryLayout>
      <div role="status" aria-label={`Loading ${label}`} aria-busy="true" data-page-loading="true">
        <Card className="w-full rounded-3xl" aria-hidden="true">
          <CardContent className="p-6 sm:p-8">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="mt-5 h-5 w-32" />
            <Skeleton className="mt-1 h-8 w-4/5" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="mt-7 space-y-5">
              {Array.from({ length: fields }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                  {fields === 2 && index === 0 && <Skeleton className="h-4 w-40" />}
                </div>
              ))}
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="mt-7 border-t pt-6">
              <Skeleton className="mx-auto h-5 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    </RecoveryLayout>
  );
}
