"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  CONTRIBUTION_TYPES,
  formatContributionType,
  formatPaymentMethod,
  PAYMENT_METHODS,
  type ContributionBranch,
  initialContributionActionState,
  type ContributionAction,
  type ContributionFormValues,
  type ContributionMemberOption,
  type ContributionServiceOption,
} from "./types";

type ContributionFormProps = {
  branches: ContributionBranch[];
  members: ContributionMemberOption[];
  services: ContributionServiceOption[];
  action: ContributionAction;
  submitLabel: string;
  values?: ContributionFormValues;
};

const defaultValues: ContributionFormValues = {
  memberId: null,
  serviceId: null,
  churchBranchId: "",
  contributionType: "tithe",
  amount: "",
  contributionDate: "",
  paymentMethod: "cash",
  notes: null,
};

export function ContributionForm({
  branches,
  members,
  services,
  action,
  submitLabel,
  values,
}: ContributionFormProps) {
  const formValues = values ?? defaultValues;
  const [branchId, setBranchId] = useState(
    formValues.churchBranchId,
  );
  const [memberId, setMemberId] = useState(
    formValues.memberId ?? "",
  );
  const [serviceId, setServiceId] = useState(
    formValues.serviceId ?? "",
  );
  const [contributionType, setContributionType] = useState(
    formValues.contributionType,
  );
  const [paymentMethod, setPaymentMethod] = useState(
    formValues.paymentMethod,
  );
  const [amount, setAmount] = useState(formValues.amount);
  const [contributionDate, setContributionDate] = useState(
    formValues.contributionDate,
  );
  const [notes, setNotes] = useState(formValues.notes ?? "");
  const [actionState, formAction] = useActionState(
    action,
    initialContributionActionState,
  );

  const existingMemberId = formValues.memberId;
  const existingServiceId = formValues.serviceId;

  const branchMembers = members.filter(
    (member) =>
      member.churchBranchId === branchId &&
      (!member.isArchived || member.id === existingMemberId),
  );
  const branchServices = services.filter(
    (service) =>
      service.churchBranchId === branchId &&
      (service.status !== "cancelled" ||
        service.id === existingServiceId),
  );
  const existingCancelledService = services.find(
    (service) =>
      service.id === existingServiceId &&
      service.status === "cancelled",
  );

  function handleBranchChange(nextBranchId: string) {
    setBranchId(nextBranchId);

    if (
      memberId &&
      !members.some(
        (member) =>
          member.id === memberId &&
          member.churchBranchId === nextBranchId,
      )
    ) {
      setMemberId("");
    }

    if (
      serviceId &&
      !services.some(
        (service) =>
          service.id === serviceId &&
          service.churchBranchId === nextBranchId,
      )
    ) {
      setServiceId("");
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {actionState.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
        >
          <p className="font-semibold">Unable to save contribution</p>
          <p className="mt-1">{actionState.error}</p>
        </div>
      )}

      <FormSection
        title="Contribution Information"
        description="Record a contribution for one of your assigned active church branches. Member and service links are optional."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Church Branch"
            htmlFor="contribution-branch"
            required
            className="md:col-span-2"
            description="Only active branches available to your account are listed."
          >
            <Select
              id="contribution-branch"
              name="church_branch_id"
              value={branchId}
              onChange={(event) =>
                handleBranchChange(event.target.value)
              }
              required
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
            label="Contributor"
            htmlFor="contribution-member"
            description="Leave as Anonymous for a contribution without a member link."
          >
            <Select
              id="contribution-member"
              name="member_id"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              disabled={!branchId || branchMembers.length === 0}
            >
              <option value="">Anonymous contribution</option>

              {branchMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                  {member.isArchived ? " (Archived historical link)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Service"
            htmlFor="contribution-service"
            description="Optional. The selected service must belong to the same branch."
          >
            {existingCancelledService && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                This contribution retains a historical link to a cancelled
                service. You may leave it unchanged or select another service.
              </p>
            )}

            <Select
              id="contribution-service"
              name="service_id"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              disabled={!branchId || branchServices.length === 0}
            >
              <option value="">No service linked</option>

              {branchServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {formatServiceDate(service.serviceDate)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Contribution Type"
            htmlFor="contribution-type"
            required
          >
            <Select
              id="contribution-type"
              name="contribution_type"
              value={contributionType}
              onChange={(event) =>
                setContributionType(
                  event.target.value as ContributionFormValues["contributionType"],
                )
              }
              required
            >
              {CONTRIBUTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatContributionType(type)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Payment Method"
            htmlFor="contribution-payment-method"
            required
          >
            <Select
              id="contribution-payment-method"
              name="payment_method"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value as ContributionFormValues["paymentMethod"],
                )
              }
              required
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {formatPaymentMethod(method)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Amount"
            htmlFor="contribution-amount"
            required
            description="Enter an amount greater than zero."
          >
            <Input
              id="contribution-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField
            label="Contribution Date"
            htmlFor="contribution-date"
            required
          >
            <Input
              id="contribution-date"
              name="contribution_date"
              type="date"
              required
              value={contributionDate}
              onChange={(event) =>
                setContributionDate(event.target.value)
              }
            />
          </FormField>

          <FormField
            label="Notes"
            htmlFor="contribution-notes"
            className="md:col-span-2"
            description="Optional notes for this contribution."
          >
            <Textarea
              id="contribution-notes"
              name="notes"
              rows={5}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any helpful notes..."
            />
          </FormField>
        </div>

        <FormActions>
          <Button variant="outline" asChild>
            <Link href="/portal/contributions">Cancel</Link>
          </Button>

          <ContributionSubmitButton label={submitLabel} />
        </FormActions>
      </FormSection>
    </form>
  );
}

function ContributionSubmitButton({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

function formatServiceDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}
