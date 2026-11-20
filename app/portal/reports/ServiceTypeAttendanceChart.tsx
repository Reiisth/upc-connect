"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import ReportChart from "./ReportChart";

type ServiceType = { label: string; attendance: number; completedServices: number };

export default function ServiceTypeAttendanceChart({ types }: { types: ServiceType[] }) {
  const [average, setAverage] = useState(false);
  const id = useId();
  return <ReportChart title="Attendance by Service Type" appearance="sparkline" compactHeader horizontal
    headerActions={<label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
      <Checkbox id={id} checked={average} onCheckedChange={value => setAverage(value === true)} />Average per service
    </label>}
    labels={types.map(type => type.label)}
    series={[{ label: average ? "Average attendees per service" : "Physical Check-ins", values: types.map(type => average
      ? type.completedServices > 0 ? type.attendance / type.completedServices : null
      : type.attendance) }]}
    emptyMessage="There is no service-type attendance to compare in this period." />;
}
