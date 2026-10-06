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
        "mx-auto w-full max-w-[1440px] space-y-6 px-3 py-5 sm:px-4 lg:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}