"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { InactivityBranch } from "@/lib/inactivity/presentation";
import { updateInactivityThreshold, type InactivitySettingsState } from "./actions";

const initialState: InactivitySettingsState = { status: "idle", message: "" };

export default function ThresholdSettings({ branch, canManage }: {
  branch: InactivityBranch;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateInactivityThreshold.bind(null, branch.id), initialState,
  );

  return (
    <Card className="border-[#5D94E8]/40 bg-[#F8FAFD]">
      <CardHeader>
        <CardTitle>Absence Follow-up Threshold</CardTitle>
        <p className="flex items-baseline gap-3 text-[#203264]" aria-label={`Follow-up threshold: ${branch.inactivityThresholdWeeks} weeks`}>
          <span className="text-6xl font-bold tabular-nums">{branch.inactivityThresholdWeeks}</span>
          <span className="text-xl font-semibold">{branch.inactivityThresholdWeeks === 1 ? "absent week" : "absent weeks"}</span>
        </p>
        <p className="text-sm text-slate-600">Consecutive eligible absent weeks before a follow-up flag.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <form action={formAction} className="space-y-3" aria-label="Absence follow-up threshold settings">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label="Absence Follow-up Threshold" htmlFor="inactivity-threshold" className="sm:max-w-56">
                <Input key={branch.inactivityThresholdWeeks} id="inactivity-threshold" name="inactivity_threshold_weeks"
                  type="number" min={1} max={52} step={1} required defaultValue={branch.inactivityThresholdWeeks}
                  disabled={pending} aria-describedby="threshold-help" />
              </FormField>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save rule"}</Button>
            </div>
            <p id="threshold-help" className="text-xs text-slate-500">
              Choose 1–52 weeks. Saving recalculates this branch’s results immediately.
            </p>
            {state.message && (
              <p role={state.status === "error" ? "alert" : "status"}
                className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>
                {state.message}
              </p>
            )}
          </form>
        ) : (
          <p className="text-xs text-slate-500">You have view-only access to this rule.</p>
        )}
      </CardContent>
    </Card>
  );
}
