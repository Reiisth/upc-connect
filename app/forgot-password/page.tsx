"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    if (loading) return;

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
      <Card className="w-full max-w-md rounded-3xl">
        <CardContent className="p-6 sm:p-8">
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/login"><ArrowLeft aria-hidden="true" />Back to Login</Link>
          </Button>
          <div className="mt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]"><Mail className="h-5 w-5" aria-hidden="true" /></div>
            <h1 className="mt-4 font-heading text-2xl font-semibold text-[#203264]">Forgot your password?</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the email address connected to your UPC Connect account. We&apos;ll send you a link to reset your password.</p>
          </div>
          {success ? (
            <div role="status" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Check your email</p>
              <p className="mt-1 text-sm text-green-700">If an account exists for that email address, a password reset link has been sent.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={loading}>
              <FormField label="Email Address" htmlFor="email" required error={error || undefined}>
                <Input id="email" name="email" type="email" value={email} onChange={event => { setEmail(event.target.value); setError(""); }} placeholder="Enter your email" autoComplete="email" required disabled={loading} aria-invalid={Boolean(error)} />
              </FormField>
              <Button type="submit" loading={loading} pendingLabel="Sending reset link..." className="w-full">Send Reset Link</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
