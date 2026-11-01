import { Building2, ShieldCheck, UserRound } from "lucide-react";
import type { PortalUserContext } from "@/lib/portal-user-context";
import { StatusBadge } from "@/components/ui/status-badge";

export function PortalIdentitySummary({ context }: { context: PortalUserContext }) {
  return (
    <section aria-label="Your account access" className="rounded-2xl border border-slate-200 bg-[#F8FAFD] p-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#203264]">
        <UserRound className="h-4 w-4 shrink-0" />
        <span className="truncate">{context.displayName}</span>
      </div>
      <div className="mt-2 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="flex flex-wrap gap-1.5">
          {context.roles.length ? context.roles.map((role) => (
            <StatusBadge key={role.key} variant="info">{role.displayName}</StatusBadge>
          )) : <span className="text-xs text-slate-500">No active roles</span>}
        </div>
      </div>
      <div className="mt-2 flex items-start gap-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="flex flex-wrap gap-1.5">
          {context.hasAllBranches ? (
            <StatusBadge variant="info">All Branches</StatusBadge>
          ) : context.branches.length ? context.branches.map((branch) => (
            <StatusBadge key={branch} variant="muted">{branch}</StatusBadge>
          )) : <span className="text-xs text-slate-500">No active branches assigned</span>}
        </div>
      </div>
    </section>
  );
}
