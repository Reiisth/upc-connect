"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";

export default function ReportsError({ reset }: { reset: () => void }) {
  return <PageContainer><div role="alert"><EmptyState title="Reports are temporarily unavailable"
    description="We could not load your reporting access or data. Please try again."
    action={<Button onClick={reset}>Try again</Button>} /></div></PageContainer>;
}
