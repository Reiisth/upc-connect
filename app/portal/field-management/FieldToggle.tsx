"use client";

import { useOptimistic, useTransition } from "react";
import { updateFieldSetting } from "./actions";

type FieldToggleProps = {
  fieldId: string;
  setting: "is_required" | "is_visible";
  checked: boolean;
  checkedLabel: string;
  uncheckedLabel: string;
  disabled?: boolean;
};

export default function FieldToggle({
  fieldId,
  setting,
  checked,
  checkedLabel,
  uncheckedLabel,
  disabled = false,
}: FieldToggleProps) {
  const [, startTransition] = useTransition();
  const [optimisticChecked, setOptimisticChecked] =
    useOptimistic(checked);

  function handleChange(nextValue: boolean) {
    if (disabled) return;

    startTransition(async () => {
      setOptimisticChecked(nextValue);

      try {
        await updateFieldSetting(
          fieldId,
          setting,
          nextValue,
        );
      } catch (error) {
        console.error(
          "Failed to update field setting:",
          error,
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={optimisticChecked}
        disabled={disabled}
        onChange={(event) =>
          handleChange(event.target.checked)
        }
        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#203264] disabled:cursor-not-allowed"
      />

      <span className="text-xs text-muted-foreground">
        {optimisticChecked
          ? checkedLabel
          : uncheckedLabel}
      </span>
    </div>
  );
}