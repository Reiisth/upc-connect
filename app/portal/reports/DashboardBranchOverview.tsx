import { Building2, CalendarDays, ChevronDown, FileText, MapPin, Radio } from "lucide-react";
import type { DashboardServiceOverview } from "@/lib/dashboard-services";
import { formatManilaTimestamp, serviceStartInstant } from "@/lib/manila-time";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatServiceType } from "@/app/portal/services/types";
import { AnimatedDisclosure } from "@/components/ui/animated-disclosure";
import { Button } from "@/components/ui/button";

export default function DashboardBranchOverview({overview,serviceTypeNames={},showReports=false}:{overview:DashboardServiceOverview;serviceTypeNames?:Record<string,string>;showReports?:boolean}) {
  const ongoing = overview.state === "ongoing";
  const reportsAction=showReports ? <Button asChild variant="outline" size="sm" className="min-h-11 rounded-full border-[#5D94E8]/20 bg-[#EEF3FB] text-[#365FA6] hover:bg-[#5D94E8]/15"><a href="#ai-decision-support"><FileText className="h-4 w-4" aria-hidden="true" />View Reports</a></Button> : null;
  return <section aria-label="Branch and current services" className="min-w-0 space-y-3">
    <div className="flex items-center gap-3 sm:gap-4">
      <Building2 className="h-7 w-7 shrink-0 text-[#365FA6] sm:h-8 sm:w-8 lg:h-9 lg:w-9" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="break-words font-body text-2xl font-semibold leading-tight tracking-tight text-[#203264] sm:text-3xl lg:text-4xl">{overview.branchName}</h2>
        {overview.branchLocation && <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{overview.branchLocation}</span></p>}
      </div>
    </div>
    <div className="space-y-3">
      {overview.services.length > 0 ? <>
        {!ongoing && <p className="text-sm text-slate-600">No ongoing service.</p>}
        <AnimatedDisclosure actions={reportsAction} trigger={
            <StatusBadge variant={ongoing ? "success" : "info"} className="px-3 py-1.5 text-sm font-semibold sm:text-base">
              {ongoing ? <Radio className="mr-2 h-4 w-4" aria-hidden="true" /> : <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />}
              {ongoing ? `${overview.services.length} Ongoing ${overview.services.length === 1 ? "Service" : "Services"}` : `${overview.scheduledTotal} Scheduled ${overview.scheduledTotal === 1 ? "Service" : "Services"}`}
              <ChevronDown className="ml-2 h-4 w-4 transition-transform group-data-[state=open]/services:rotate-180" aria-hidden="true" />
            </StatusBadge>
          }>
          {!ongoing && <p className="text-sm text-slate-600">{overview.scheduledTotal > overview.services.length ? `Next ${overview.services.length} scheduled services:` : "Coming up next:"}</p>}
          <ul aria-label={ongoing ? "Ongoing services" : "Upcoming scheduled services"} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {overview.services.map(service => <li key={service.id} className="min-w-0 rounded-xl border border-white bg-white/80 p-3 shadow-sm shadow-[#203264]/[0.03]">
          <p className="break-words text-sm font-semibold text-[#203264]">{service.name}</p>
          <p className="mt-1 text-xs font-medium text-[#365FA6]">{formatServiceType(service.serviceType || "service",serviceTypeNames)}</p>
          {overview.multipleBranches && <p className="mt-0.5 text-xs font-medium text-[#365FA6]">{service.branchName}</p>}
          <p className="mt-1 text-xs text-slate-500">{ongoing ? "Started " : ""}<time dateTime={new Date(serviceStartInstant(service.date,service.startTime)).toISOString()}>{formatManilaTimestamp(new Date(serviceStartInstant(service.date,service.startTime)).toISOString())}</time></p>
        </li>)}
          </ul>
        </AnimatedDisclosure>
      </> : <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-slate-600" role={overview.state === "unavailable" ? "status" : undefined}>{overview.state === "unavailable" ? "Service status is currently unavailable. Refresh to try again." : overview.state === "no-access" ? "No accessible branch is available for service status." : "No ongoing or scheduled services."}</p>{reportsAction}</div>}
    </div>
  </section>;
}
