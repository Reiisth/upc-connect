"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordForm({
  email,
}: {
  email: string;
}) {
  const supabase = createClient();

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
      // Verify the user's current password first.
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

      if (signInError) {
        setError("Current password is incorrect.");
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        setError(updateError.message);
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

  const inputClass =
    "w-full rounded-xl border bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 max-w-xl space-y-5"
    >
      <PasswordField
        id="current_password"
        label="Current Password"
        value={currentPassword}
        onChange={setCurrentPassword}
        visible={showCurrent}
        onToggle={() => setShowCurrent((current) => !current)}
        inputClass={inputClass}
      />

      <PasswordField
        id="new_password"
        label="New Password"
        value={newPassword}
        onChange={setNewPassword}
        visible={showNew}
        onToggle={() => setShowNew((current) => !current)}
        inputClass={inputClass}
      />

      <PasswordField
        id="confirm_password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((current) => !current)}
        inputClass={inputClass}
      />

      {error && (
        <p className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm font-medium text-green-600">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-[#5D94E8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4B82D6] disabled:cursor-not-allowed disabled:opacity-60"
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
      </button>
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
  inputClass,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  inputClass: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-[#203264]"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          autoComplete={
            id === "current_password"
              ? "current-password"
              : "new-password"
          }
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#203264]"
        >
          {visible ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}