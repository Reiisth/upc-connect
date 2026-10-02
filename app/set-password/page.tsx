"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push("/portal/profile");
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
        <section className="hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white p-1">
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
                Member Portal
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
              Set a secure password to continue activating your member account
              and completing your profile.
            </p>
          </div>

          <p className="text-xs text-white/60">
            United Pentecostal Church Batangas
          </p>
        </section>

        {/* FORM SIDE */}
        <section className="flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            {/* MOBILE BRAND */}
            <div className="mb-8 flex justify-center lg:hidden">
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
                    Member Portal
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
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
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-[#203264]"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-[#203264]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}
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
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-[#203264]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ERROR */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* SUBMIT */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating password...
                    </>
                  ) : (
                    "Create Password"
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

