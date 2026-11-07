"use client";

import { useId, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/** Only the selected group mounts its charts; filters and AI stay outside this panel. */
export default function ReportDashboardGroups({ groups }: {
  groups: { id: string; label: string; content: ReactNode }[];
}) {
  const [selected, setSelected] = useState("membership");
  const prefix = useId();
  const active = groups.find(group => group.id === selected) ?? groups[0];
  if (!active) return null;
  return <div className="min-w-0 space-y-4">
    <nav aria-label="Report sections" className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Dashboard chart groups" className="flex flex-wrap gap-2">
        {groups.map((group, index) => <button key={group.id} type="button" role="tab"
          id={`${prefix}-tab-${group.id}`} aria-controls={`${prefix}-panel`}
          aria-selected={active.id === group.id} tabIndex={active.id === group.id ? 0 : -1}
          onClick={() => setSelected(group.id)}
          onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % groups.length : event.key === "ArrowLeft" ? (index - 1 + groups.length) % groups.length : event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); setSelected(groups[next].id);
            document.getElementById(`${prefix}-tab-${groups[next].id}`)?.focus();
          }}
          className={`rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${active.id === group.id ? "border-[#203264] bg-[#203264] text-white" : "border-slate-200 bg-white text-[#365FA6] hover:border-blue-300 hover:bg-blue-50"}`}>
          {group.label}
        </button>)}
      </div>
      <a href="#ai-decision-support" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#365FA6] transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2">AI Decision Support</a>
    </nav>
    <Card className="min-w-0">
      <CardContent id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-tab-${active.id}`} tabIndex={0} className="min-w-0 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] sm:p-6">
        {active.content}
      </CardContent>
    </Card>
  </div>;
}
