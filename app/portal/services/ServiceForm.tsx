"use client";
import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  type ServiceType,
  type ServiceTypeOption,
} from "./types";
import type { ServiceBranchOption } from "./access";

export type ServiceFormValues = {
  name: string;
  serviceType: ServiceType;
  serviceDate: string;
  startTime: string | null;
  churchBranchId: string;
  notes: string | null;
};

type ServiceFormProps = {
  branches: ServiceBranchOption[];
  serviceTypes: ServiceTypeOption[];
  action: (formData: FormData) => void | Promise<void | {error:string}>;
  submitLabel: string;
  values?: ServiceFormValues;
};

const defaultValues: ServiceFormValues = {
  name: "",
  serviceType: "",
  serviceDate: "",
  startTime: null,
  churchBranchId: "",
  notes: null,
};

export function ServiceForm({
  branches,
  serviceTypes,
  action,
  submitLabel,
  values,
}: ServiceFormProps) {
  const [error,setError] = useState("");
  const [pending,start] = useTransition();
  const formValues = values ?? { ...defaultValues, serviceType: serviceTypes.find((type) => type.isActive)?.key ?? "" };

  return (
    <form onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); setError("");
      start(async () => { try { const result = await action(data); if(result?.error) setError(result.error); }
        catch(error) { unstable_rethrow(error); setError(error instanceof Error ? error.message : "Unable to save Service."); }
      });
    }} className="space-y-6">
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
              disabled={serviceTypes.length === 0}
            >
              {serviceTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.name}{!type.isActive ? " (Inactive — existing service)" : ""}
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
            required
            description="Asia/Manila. A start at or before now makes the Service Ongoing immediately."
          >
            <Input
              id="start-time"
              name="start_time"
              required
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
            description="Only active branches assigned to your account are available. Branch changes lock after attendance or linked contributions; date changes lock after attendance."
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

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <FormActions>
          <Button variant="outline" asChild>
            <Link href="/portal/services">Cancel</Link>
          </Button>

          <Button type="submit" disabled={pending || branches.length === 0 || serviceTypes.length === 0}>
            {submitLabel}
          </Button>
        </FormActions>
      </FormSection>
    </form>
  );
}
