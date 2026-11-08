import { CalendarClock, CircleCheck, CirclePlay, CircleX } from "lucide-react";
import { formatServiceStatus, type ServiceStatus } from "./types";

const appearances = {
  scheduled: { Icon: CalendarClock, color: "bg-yellow-50 text-yellow-700" },
  ongoing: { Icon: CirclePlay, color: "bg-green-50 text-green-700" },
  completed: { Icon: CircleCheck, color: "bg-blue-50 text-blue-700" },
  cancelled: { Icon: CircleX, color: "bg-slate-100 text-slate-600" },
};

export default function ServiceStatusIcon({ status, onClick, disabled, actionLabel, expanded = false }: { status: ServiceStatus; onClick?: () => void; disabled?: boolean; actionLabel?: string; expanded?: boolean }) {
  const { Icon, color } = appearances[status];
  const Tag = onClick ? "button" : "span";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick} disabled={disabled} tabIndex={0} aria-label={actionLabel ?? formatServiceStatus(status)} title={actionLabel} className={`group inline-flex shrink-0 min-h-9 disabled:cursor-wait disabled:opacity-50 items-center rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] ${color}`}>
    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
    <span aria-hidden="true" className={expanded ? "ml-2 whitespace-nowrap text-xs font-semibold" : "max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-24 group-hover:opacity-100 group-focus:ml-2 group-focus:max-w-24 group-focus:opacity-100 motion-reduce:transition-none"}>{formatServiceStatus(status)}</span>
  </Tag>;
}
