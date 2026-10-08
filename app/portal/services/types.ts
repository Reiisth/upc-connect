export const SERVICE_TYPES = [
  "sunday_morning",
  "sunday_evening",
  "prayer_meeting",
  "special_service",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_STATUSES = [
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceBranch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type ServiceRecord = {
  id: string;
  name: string;
  serviceType: ServiceType;
  serviceDate: string;
  startTime: string | null;
  status: ServiceStatus;
  churchBranchId: string;
  notes: string | null;
  branch: ServiceBranch | null;
};

export function formatServiceType(value: string) {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function formatServiceStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
