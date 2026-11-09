"use client";

import MemberAutocomplete from "./MemberAutocomplete";
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
  CONTRIBUTOR_TYPES,
  type ContributorType,
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
  contributorType: "anonymous",
  visitorName: null,
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
  const [contributorType, setContributorType] = useState<ContributorType>(formValues.contributorType);
  const [visitorName, setVisitorName] = useState(formValues.visitorName ?? "");
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
      member.id === existingMemberId ||
      !member.isArchived,
  );
  const branchServices = services.filter(
    (service) =>
      service.id === existingServiceId ||
      service.churchBranchId === branchId && service.status !== "cancelled",
  );
  const existingCancelledService = services.find(
    (service) =>
      service.id === existingServiceId &&
      service.status === "cancelled",
  );

  function handleBranchChange(nextBranchId: string) {
    setBranchId(nextBranchId);

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
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">Unable to save contribution</p>
          <p className="mt-1">{actionState.error}</p>
        </div>
      )}

      <FormSection
        title="Contribution Information"
        description={values ? "The historical branch is fixed. Existing member and service links can be retained; replacements must meet current eligibility rules." : "Record a contribution for one of your assigned active church branches. Choose a Member from any home branch, a named Visitor, or Anonymous. Service links are optional."}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Church Branch"
            htmlFor="contribution-branch"
            required
            className="md:col-span-2"
            description={values ? "Contribution branch cannot be changed after creation." : "Only active branches available to your account are listed."}
          >
            {values && <input type="hidden" name="church_branch_id" value={branchId} />}
            <Select
              id="contribution-branch"
              name="church_branch_id"
              value={branchId}
              onChange={(event) =>
                handleBranchChange(event.target.value)
              }
              required
              disabled={Boolean(values) || branches.length === 0}
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

          <FormField label="Contributor Type" htmlFor="contributor-type" required>
            <Select id="contributor-type" name="contributor_type" value={contributorType}
              onChange={event => { setContributorType(event.target.value as ContributorType); setMemberId(""); setVisitorName(""); }} required>
              {CONTRIBUTOR_TYPES.map(type => <option key={type} value={type}>{formatContributionType(type)}</option>)}
            </Select>
          </FormField>
          {contributorType === "member" && <FormField label="Member" htmlFor="contribution-member" required>
            <MemberAutocomplete members={branchMembers} value={memberId} onChange={setMemberId} branchId={branchId}/>
          </FormField>}
          {contributorType === "visitor" && <FormField label="Visitor Name" htmlFor="visitor-name" required description="Name retained on this contribution only.">
            <Input id="visitor-name" name="visitor_name" value={visitorName} onChange={event => setVisitorName(event.target.value)} maxLength={160} required />
          </FormField>}


          <FormField
            label="Service"
            htmlFor="contribution-service"
            description="Optional. The selected service must belong to the same branch."
          >
            {existingCancelledService && (
              <p className="mb-2 text-xs text-amber-700">
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
    <Button type="submit" loading={pending} disabled={pending}>
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
