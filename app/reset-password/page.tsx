"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck, Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RecoveryLayout } from "@/components/ui/recovery-layout";

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

    if (loading) return;

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
    <RecoveryLayout>
      <Card className="w-full max-w-md rounded-3xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>

          <p className="mt-5 text-sm font-medium text-[#5D94E8]">
            Account recovery
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-[#203264]">
            Create a new password
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter a new password for your UPC Connect account.
          </p>

          {success ? (
            <div role="status" className="mt-7 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                Password updated
              </p>

              <p className="mt-2 text-sm leading-6 text-green-700">
                Your password has been successfully changed.
                Redirecting you to login...
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-5"
              aria-busy={loading}
            >
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#203264]"
                >
                  New Password
                </label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    autoComplete="new-password"
                    placeholder="Enter your new password"
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "reset-password-error" : "password-hint"}
                    className="pr-12"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#203264]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p id="password-hint" className="mt-2 text-xs text-muted-foreground">
                  Use at least 8 characters.
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-medium text-[#203264]"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <Input
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
                    placeholder="Confirm your new password"
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "reset-password-error" : undefined}
                    className="pr-12"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                    aria-pressed={showConfirmPassword}
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current,
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#203264]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div id="reset-password-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                pendingLabel="Updating password..."
                disabled={loading}
                className="h-11 w-full font-semibold"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Reset Password
              </Button>
            </form>
          )}
          <div className="mt-7 border-t pt-6 text-center">
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </RecoveryLayout>
  );
}
