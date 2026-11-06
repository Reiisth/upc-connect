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
        "mx-auto w-full max-w-[1440px] space-y-4 px-2 py-3 sm:px-3 lg:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}