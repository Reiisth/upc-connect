"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email address is required.");
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );

      if (error) {
        setError(
          "Unable to send the password reset email. Please try again.",
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(
        "Unable to connect. Please check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-[#203264]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        <div className="mt-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]">
            <Mail className="h-5 w-5" />
          </div>

          <h1 className="mt-4 font-body text-2xl font-semibold text-[#203264]">
            Forgot your password?
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter the email address connected to your UPC Connect account.
            We&apos;ll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Check your email
            </p>

            <p className="mt-1 text-sm text-green-700">
              If an account exists for that email address, a password reset
              link has been sent.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#203264]"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={loading}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                  error
                    ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                    : "focus:border-[#5D94E8] focus:ring-[#5D94E8]/10"
                }`}
              />

              {error && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-[#5D94E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4B82D6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending reset link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}