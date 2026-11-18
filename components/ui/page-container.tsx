import * as React from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-[1440px] space-y-5 py-1 sm:space-y-6 sm:py-2 [&>[data-page-heading-only]+*]:!mt-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
