import { cn } from "@/lib/utils";

export function MemberStatus({ status, className }: { status: string | null | undefined; className?: string }) {
  const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Unknown";
  return <span tabIndex={0} role="img" aria-label={`Member status: ${label.toLowerCase()}`}
    className={cn("group inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2", status === "active" ? "bg-emerald-500" : "bg-slate-400", className)}>
    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" />
    <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white transition-all group-hover:max-w-24 group-hover:pr-2 group-focus:max-w-24 group-focus:pr-2">{label}</span>
  </span>;
}
