import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  formatServiceStatus,
  formatServiceType,
  SERVICE_STATUSES,
  SERVICE_TYPES,
  type ServiceStatus,
  type ServiceType,
} from "./types";
import type { ServiceBranchOption } from "./access";

export type ServiceFormValues = {
  name: string;
  serviceType: ServiceType;
  serviceDate: string;
  startTime: string | null;
  status: ServiceStatus;
  churchBranchId: string;
  notes: string | null;
};

type ServiceFormProps = {
  branches: ServiceBranchOption[];
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  values?: ServiceFormValues;
};

const defaultValues: ServiceFormValues = {
  name: "",
  serviceType: "sunday_morning",
  serviceDate: "",
  startTime: null,
  status: "scheduled",
  churchBranchId: "",
  notes: null,
};

export function ServiceForm({
  branches,
  action,
  submitLabel,
  values,
}: ServiceFormProps) {
  const formValues = values ?? defaultValues;

  return (
    <form action={action} className="space-y-6">
      <FormSection
        title="Service Information"
        description="Schedule a service for one of your assigned active church branches."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Service Name"
            htmlFor="service-name"
            required
            className="md:col-span-2"
            description="Use a clear name that staff can recognize in schedules."
          >
            <Input
              id="service-name"
              name="name"
              type="text"
              required
              maxLength={200}
              defaultValue={formValues.name}
              placeholder="e.g. Sunday Morning Worship"
            />
          </FormField>

          <FormField
            label="Service Type"
            htmlFor="service-type"
            required
          >
            <Select
              id="service-type"
              name="service_type"
              required
              defaultValue={formValues.serviceType}
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatServiceType(type)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Status"
            htmlFor="service-status"
            required
            description="Use Cancelled instead of deleting a service."
          >
            <Select
              id="service-status"
              name="status"
              required
              defaultValue={formValues.status}
            >
              {SERVICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatServiceStatus(status)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Service Date"
            htmlFor="service-date"
            required
          >
            <Input
              id="service-date"
              name="service_date"
              type="date"
              required
              defaultValue={formValues.serviceDate}
            />
          </FormField>

          <FormField
            label="Start Time"
            htmlFor="start-time"
            description="Optional. Use the local branch time."
          >
            <Input
              id="start-time"
              name="start_time"
              type="time"
              step="60"
              defaultValue={formValues.startTime ?? ""}
            />
          </FormField>

          <FormField
            label="Church Branch"
            htmlFor="church-branch"
            required
            className="md:col-span-2"
            description="Only active branches assigned to your account are available."
          >
            <Select
              id="church-branch"
              name="church_branch_id"
              required
              defaultValue={formValues.churchBranchId}
              disabled={branches.length === 0}
            >
              <option value="" disabled>
                Select a church branch
              </option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.code ? ` (${branch.code})` : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Notes"
            htmlFor="service-notes"
            className="md:col-span-2"
            description="Optional notes for staff planning and coordination."
          >
            <Textarea
              id="service-notes"
              name="notes"
              rows={5}
              defaultValue={formValues.notes ?? ""}
              placeholder="Add any helpful service notes..."
            />
          </FormField>
        </div>

        <FormActions>
          <Button variant="outline" asChild>
            <Link href="/portal/services">Cancel</Link>
          </Button>

          <Button type="submit" disabled={branches.length === 0}>
            {submitLabel}
          </Button>
        </FormActions>
      </FormSection>
    </form>
  );
}
