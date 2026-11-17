"use client";
import { FeedbackMessage } from "@/components/ui/feedback-message";


import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { changeOwnPassword } from "./actions";

export default function ChangePasswordForm() {

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!error) return;
    const first = Object.keys(fieldErrors)[0];
    formRef.current?.querySelector<HTMLElement>(first ? `#${first}` : "[data-password-error]")?.focus();
  }, [error, fieldErrors]);

  function editField(id: string, value: string, setter: (value: string) => void) {
    setter(value);setError("");setSuccess("");
    setFieldErrors(current => { const next = { ...current };delete next[id];return next; });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");
    const errors: Record<string,string> = {};
    if (!currentPassword) errors.current_password = "Enter your current password.";
    if (!newPassword) errors.new_password = "Enter a new password.";
    else if (newPassword.length < 8) errors.new_password = "Use at least 8 characters.";
    else if (currentPassword === newPassword) errors.new_password = "Choose a password different from your current password.";
    if (!confirmPassword) errors.confirm_password = "Re-enter your new password.";
    else if (newPassword !== confirmPassword) errors.confirm_password = "The passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Review the highlighted password fields.");
      return;
    }

    setLoading(true);

    try {
      const result = await changeOwnPassword(currentPassword, newPassword);
      if (result.error) {
        setError(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccess("Your password has been changed successfully.");
    } catch {
      setError(
        "Something went wrong while changing your password.",
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      className="max-w-xl space-y-5"
    >
      {error && <FeedbackMessage tabIndex={-1} data-password-error>{error}
        {Object.keys(fieldErrors).length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(fieldErrors).map(([id,message]) => <li key={id}><a className="underline" href={`#${id}`} onClick={event => { event.preventDefault();formRef.current?.querySelector<HTMLElement>(`#${id}`)?.focus(); }}>{message}</a></li>)}</ul>}
      </FeedbackMessage>}
      <PasswordField
        id="current_password"
        label="Current Password"
        value={currentPassword}
        onChange={value => editField("current_password", value, setCurrentPassword)}
        error={fieldErrors.current_password}
        disabled={loading}
        visible={showCurrent}
        onToggle={() => setShowCurrent((current) => !current)}
      />

      <PasswordField
        id="new_password"
        label="New Password"
        value={newPassword}
        onChange={value => editField("new_password", value, setNewPassword)}
        error={fieldErrors.new_password}
        description="Use at least 8 characters and choose a password different from your current password."
        disabled={loading}
        visible={showNew}
        onToggle={() => setShowNew((current) => !current)}
      />

      <PasswordField
        id="confirm_password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={value => editField("confirm_password", value, setConfirmPassword)}
        error={fieldErrors.confirm_password}
        description="Re-enter your new password exactly as entered above."
        disabled={loading}
        visible={showConfirm}
        onToggle={() => setShowConfirm((current) => !current)}
      />

      {success && (
        <FeedbackMessage variant="success">{success}</FeedbackMessage>
      )}

      <FormActions>
      <Button
        type="submit"
        loading={loading} disabled={loading}
        className="min-w-[170px]"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Changing...
          </>
        ) : (
          <>
            <LockKeyhole className="h-4 w-4" />
            Change Password
          </>
        )}
      </Button>
      </FormActions>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  description,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  description?: string;
  error?: string;
  disabled: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} required description={description} error={error}>
      <div className="relative">
        <Input
          id={id}
          name={id}
          required
          minLength={id === "new_password" ? 8 : undefined}
          disabled={disabled}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-12"
          autoComplete={
            id === "current_password"
              ? "current-password"
              : "new-password"
          }
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
          className="absolute right-0.5 top-1/2 h-10 w-10 -translate-y-1/2 text-slate-600"
        >
          {visible ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </Button>
      </div>
    </FormField>
  );
}
