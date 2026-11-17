import { cn } from "@/lib/utils";

export function MemberStatus({ status, className }: { status: string | null | undefined; className?: string }) {
  const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Unknown";
  return <span aria-label={`Member status: ${label.toLowerCase()}`}
    className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700", className)}>
    <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", status === "active" ? "bg-emerald-700" : "bg-slate-500")} />
    <span>{label}</span>
  </span>;
}
