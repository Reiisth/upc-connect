import type { ServiceStatus } from "./types";
import { serviceStartInstant } from "@/lib/manila-time";

export function effectiveServiceStatus(service: {status:string; serviceDate:string; startTime:string|null}, now: Date = new Date()): ServiceStatus {
  if (service.status === "completed" || service.status === "cancelled") return service.status;
  if (service.status !== "scheduled" && service.status !== "ongoing") throw new Error("Unsupported service status.");
  // Legacy missing times start at Manila midnight. New schedules require a time.
  const start = serviceStartInstant(service.serviceDate,service.startTime);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid lifecycle reference time.");
  return start <= now.getTime() ? "ongoing" : "scheduled";
}
export function effectiveStoredServiceStatus(service: {status:string; service_date:string; start_time:string|null}, now: Date = new Date()) {
  return effectiveServiceStatus({status:service.status,serviceDate:service.service_date,startTime:service.start_time},now);
}
export function allowedServiceStatuses(status: ServiceStatus): readonly ServiceStatus[] {
  return status === "scheduled" ? ["cancelled"] : status === "ongoing" ? ["completed","cancelled"] : [];
}
export function assertServiceTransition(current: ServiceStatus, next: ServiceStatus) {
  if (!allowedServiceStatuses(current).includes(next)) throw new Error("This service cannot return to an earlier or different final status.");
}
export function canRecordServiceAttendance(status: string) { return status === "ongoing"; }
export function canCorrectServiceAttendance(status: string) { return status === "ongoing"; }
export function assertServiceAttendance(status: string, operation: "record" | "correct") {
  if (status !== "ongoing") throw new Error(`${status.charAt(0).toUpperCase()+status.slice(1)} services are read-only. ${operation === "correct" ? "Corrections are" : "Recording is"} allowed only while a service is ongoing.`);
}
