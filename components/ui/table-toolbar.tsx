import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export function TableToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center [&>select]:w-full lg:[&>select]:w-52", className)} {...props} />;
}

export function SearchInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <div className="relative min-w-0 flex-1">
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <Input type="search" className={cn("pl-9", className)} {...props} />
  </div>;
}
