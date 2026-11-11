"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CircleCheck } from "lucide-react";
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
      const { data, error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );

      console.log("Password reset data:", data);
      console.log("Password reset error:", error);

      if (error) {
        console.error("Supabase password reset error:", {
          message: error.message,
          status: error.status,
          name: error.name,
          error,
        });

        setError(
          `Unable to send reset email: ${error.message}`,
        );

        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Unexpected password reset error:", err);

      setError(
        "Unable to connect. Please check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="hidden bg-gradient-to-br from-[#5D94E8] to-[#203264] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/upc-logo.png"
            alt="UPC Batangas"
            width={52}
            height={52}
            className="h-13 w-13 object-contain"
          />
          <div>
            <p className="font-heading text-xl font-semibold">UPC CONNECT</p>
            <p className="text-sm text-white/70">
              United Pentecostal Church Batangas
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <h2 className="font-heading text-4xl font-semibold leading-tight">
            One church.
            <br />
            One connected community.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/75">
            Recover access to your account and stay connected to your church
            community.
          </p>
        </div>

        <p className="text-xs text-white/50">UPC Batangas</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/upc-logo.png"
              alt="UPC Batangas"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="font-heading text-lg font-semibold text-[#203264]">
                UPC CONNECT
              </p>
              <p className="text-xs text-muted-foreground">
                United Pentecostal Church Batangas
              </p>
            </div>
          </div>

          <Card className="w-full max-w-md rounded-3xl">
            <CardContent className="p-6 sm:p-8">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FB] text-[#203264]">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>

                <p className="mt-5 text-sm font-medium text-[#5D94E8]">
                  Account recovery
                </p>
                <h1 className="mt-1 font-heading text-2xl font-semibold text-[#203264]">
                  Forgot your password?
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Enter the email address connected to your UPC Connect account.
                  We&apos;ll send you a link to reset your password.
                </p>
              </div>

              {success ? (
                <div
                  role="status"
                  className="mt-7 rounded-xl border border-green-200 bg-green-50 p-4"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                    <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Check your email
                  </p>

                  <p className="mt-2 text-sm leading-6 text-green-700">
                    If an account exists for that email address, a password reset
                    link has been sent.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-green-700">
                    Check your spam or junk folder if you don&apos;t see it in your
                    inbox.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="mt-7 space-y-5"
                  aria-busy={loading}
                >
                  <FormField
                    label="Email Address"
                    htmlFor="email"
                    required
                    error={error || undefined}
                  >
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                      disabled={loading}
                      aria-invalid={Boolean(error)}
                    />
                  </FormField>

                  <Button
                    type="submit"
                    loading={loading}
                    pendingLabel="Sending reset link..."
                    className="h-11 w-full font-semibold"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Send Reset Link
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
        </div>
      </section>
    </main>
  );
}
