"use client";

import { useState } from "react";
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

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "Your new password must be different from your current password.",
      );
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
      onSubmit={handleSubmit}
      className="max-w-xl space-y-5"
    >
      <PasswordField
        id="current_password"
        label="Current Password"
        value={currentPassword}
        onChange={setCurrentPassword}
        visible={showCurrent}
        onToggle={() => setShowCurrent((current) => !current)}
      />

      <PasswordField
        id="new_password"
        label="New Password"
        value={newPassword}
        onChange={setNewPassword}
        visible={showNew}
        onToggle={() => setShowNew((current) => !current)}
      />

      <PasswordField
        id="confirm_password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((current) => !current)}
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-sm font-medium text-green-600">
          {success}
        </p>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
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
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400"
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