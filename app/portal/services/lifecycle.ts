import type { ServiceStatus } from "./types";

const transitions: Record<ServiceStatus, readonly ServiceStatus[]> = {
  scheduled: ["scheduled", "ongoing", "completed", "cancelled"],
  ongoing: ["ongoing", "completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export function allowedServiceStatuses(status: ServiceStatus): readonly ServiceStatus[] {
  return transitions[status] ?? [];
}

export function assertServiceTransition(current: ServiceStatus, next: ServiceStatus) {
  if (!allowedServiceStatuses(current).includes(next)) {
    throw new Error("This service cannot return to an earlier or different final status.");
  }
}

export function canRecordServiceAttendance(status: string) {
  return status === "scheduled" || status === "ongoing";
}

export function canCorrectServiceAttendance(status: string) {
  return canRecordServiceAttendance(status) || status === "completed";
}

export function assertServiceAttendance(status: string, operation: "record" | "correct") {
  const allowed = operation === "record" ? canRecordServiceAttendance(status) : canCorrectServiceAttendance(status);
  if (!allowed) {
    throw new Error(status === "cancelled"
      ? "Cancelled services are read-only. Existing attendance is preserved."
      : operation === "record" && status === "completed"
        ? "New attendance is closed for completed services. Only existing records can be corrected."
        : "Attendance is not available for this service status.");
  }
}
