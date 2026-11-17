import { CalendarClock, CircleCheck, CirclePlay, CircleX } from "lucide-react";
import { formatServiceStatus, type ServiceStatus } from "./types";

const appearances = {
  scheduled: { Icon: CalendarClock, color: "bg-amber-50 text-amber-800" },
  ongoing: { Icon: CirclePlay, color: "bg-emerald-50 text-emerald-800" },
  completed: { Icon: CircleCheck, color: "bg-blue-50 text-blue-800" },
  cancelled: { Icon: CircleX, color: "bg-slate-100 text-slate-700" },
};

/** Status is information. Lifecycle actions are separate, named controls. */
export default function ServiceStatusIcon({ status }: { status: ServiceStatus }) {
  const { Icon, color } = appearances[status];
  return <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{formatServiceStatus(status)}
  </span>;
}
