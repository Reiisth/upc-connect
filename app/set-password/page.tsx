"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { setAccountPassword } from "./actions";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const inviteInitializationStarted = useRef(false);

  useEffect(() => {
    if (inviteInitializationStarted.current) return;
    inviteInitializationStarted.current = true;
    // Standard ConfirmationURL invites return an implicit session in the hash.
    // The shared SSR browser client uses PKCE, so accept this invite explicitly
    // through setSession and let its cookie adapter persist the verified session.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const isInvite = params.get("type") === "invite";
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!isInvite && !params.has("error")) {
      setSessionReady(true); // Already verified by /auth/confirm or cookie session.
      return;
    }

    // Remove credentials from browser history before initializing the client.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (params.has("error") || !accessToken || !refreshToken) {
      setError("This invitation is invalid or expired. Please request a new invitation.");
      return;
    }
    const client = createClient();
    void client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setError("This invitation is invalid or expired. Please request a new invitation.");
        else setSessionReady(true);
      })
      .catch(() => setError("Unable to verify your invitation. Please try opening the link again."));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !sessionReady) return;
    setError(null);

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
      const result = await setAccountPassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.destination) router.replace(result.destination);

      router.refresh();
    } catch {
      setError(
        "Unable to reach the server. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* BRANDING SIDE */}
        <section className="hidden bg-gradient-to-br from-[#5D94E8] to-[#203264] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <Image
                src="/upc-logo.png"
                alt="UPC Connect"
                width={52}
                height={52}
                priority
              />
            </div>

            <div>
              <p className="font-heading text-xl font-semibold">
                UPC CONNECT
              </p>
              <p className="text-sm text-white/70">
                Unified Portal
              </p>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="text-sm font-medium uppercase tracking-widest text-white/70">
              Welcome to UPC Connect
            </p>

            <h1 className="mt-4 font-body text-4xl font-semibold leading-tight">
              Create your account password.
            </h1>

            <p className="mt-4 max-w-md leading-7 text-white/80">
              Set a secure password to continue activating your account.
            </p>
          </div>

          <p className="text-xs text-white/60">
            United Pentecostal Church Batangas
          </p>
        </section>

        {/* FORM SIDE */}
        <section className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            {/* MOBILE BRAND */}
            <div className="mb-8 flex lg:hidden">
              <div className="flex items-center gap-3">
                <Image
                  src="/upc-logo.png"
                  alt="UPC Connect"
                  width={52}
                  height={52}
                  priority
                />

                <div>
                  <p className="font-heading text-xl font-semibold text-[#203264]">
                    UPC CONNECT
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Unified Portal
                  </p>
                </div>
              </div>
            </div>

            <Card className="rounded-3xl"><CardContent className="p-6 sm:p-8">
              <div>
                <p className="text-sm font-medium text-[#5D94E8]">
                  Account Setup
                </p>

                <h1 className="mt-2 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
                  Create your password
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose a secure password with at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                {/* PASSWORD */}
                <FormField label="Password" htmlFor="password" required>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      disabled={loading}
                      minLength={8}
                      className="pr-12"
                    />

                    <Button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      variant="ghost" size="icon" disabled={loading}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </FormField>

                {/* CONFIRM PASSWORD */}
                <FormField label="Confirm Password" htmlFor="confirm-password" required>

                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      required
                      disabled={loading}
                      minLength={8}
                      className="pr-12"
                    />

                    <Button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
                      }
                      variant="ghost" size="icon" disabled={loading}
                      aria-pressed={showConfirmPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </FormField>

                {/* ERROR */}
                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* SUBMIT */}
                <Button type="submit" disabled={!sessionReady} loading={loading} pendingLabel="Creating password..." className="w-full">Create Password</Button>
              </form>
            </CardContent></Card>
          </div>
        </section>
      </div>
    </main>
  );
}

