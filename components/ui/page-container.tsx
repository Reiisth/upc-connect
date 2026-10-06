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
        "mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}