"use client";

import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(
          "Unable to reset your password. The reset link may be invalid or expired.",
        );
        setLoading(false);
        return;
      }

      setSuccess(true);

      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      setError(
        "Unable to connect. Please check your internet connection and try again.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]">
          <KeyRound className="h-5 w-5" />
        </div>

        <h1 className="mt-4 font-body text-2xl font-semibold text-[#203264]">
          Create a new password
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter a new password for your UPC Connect account.
        </p>

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Password updated
            </p>

            <p className="mt-1 text-sm text-green-700">
              Your password has been successfully changed.
              Redirecting you to login...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#203264]"
              >
                New Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#203264]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-medium text-[#203264]"
              >
                Confirm Password
              </label>

              <div className="relative">
                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword ? "text" : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      (current) => !current,
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#203264]"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-[#5D94E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4B82D6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Updating password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-[#5D94E8] hover:text-[#203264]"
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}