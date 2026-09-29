"use client";

import Image from "next/image";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";


export default function LoginPage() {
  useEffect(() => {
    function resetLoginForm() {
      setEmail("");
      setPassword("");
      setShowPassword(false);

      setEmailError("");
      setPasswordError("");
      setGeneralError("");

      setLoading(false);
    }

    resetLoginForm();

    window.addEventListener("pageshow", resetLoginForm);

    return () => {
      window.removeEventListener("pageshow", resetLoginForm);
    };
  }, []);
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setEmailError("Email address is required.");
      return;
    }

    if (!password) {
      setPasswordError("Password is required.");
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (error) {
        if (
          error.message
            .toLowerCase()
            .includes("invalid login credentials")
        ) {
          setGeneralError(
            "The email or password you entered is incorrect.",
          );
        } else if (
          error.message
            .toLowerCase()
            .includes("email not confirmed")
        ) {
          setEmailError(
            "This email address has not been confirmed yet.",
          );
        } else {
          setGeneralError(
            "Unable to sign in. Please try again.",
          );
        }

        setLoading(false);
        return;
      }

      router.push("/portal");
      router.refresh();
    } catch {
      setGeneralError(
        "Unable to connect. Please check your internet connection and try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* BRANDING */}
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
            <p className="font-heading text-xl font-semibold">
              UPC CONNECT
            </p>

            <p className="text-sm text-white/70">
              United Pentecostal Church Batangas
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="font-heading text-4xl font-semibold leading-tight">
            One church.
            <br />
            One connected community.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-7 text-white/75">
            Access your UPC Connect account to manage the
            information and services available to you.
          </p>
        </div>

        <p className="text-xs text-white/50">
          UPC Batangas
        </p>
      </section>

      {/* LOGIN */}
      <section className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* MOBILE BRAND */}
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

          <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-medium text-[#5D94E8]">
                Welcome back
              </p>

              <h2 className="mt-1 font-body text-2xl font-semibold text-[#203264]">
                Sign in to your account
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Enter your account credentials to continue.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="mt-7 space-y-5"
            >
              {/* EMAIL */}
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

                    if (emailError) {
                      setEmailError("");
                    }

                    if (generalError) {
                      setGeneralError("");
                    }
                  }}
                  autoComplete="email"
                  placeholder="Enter your email"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 ${emailError
                    ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                    : "focus:border-[#5D94E8] focus:ring-[#5D94E8]/10"
                    }`}
                />

                {emailError && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {emailError}
                  </p>
                )}
              </div>

              {/* PASSWORD */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-[#203264]"
                  >
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-[#5D94E8] transition hover:text-[#203264]"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);

                      if (passwordError) {
                        setPasswordError("");
                      }

                      if (generalError) {
                        setGeneralError("");
                      }
                    }}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={loading}
                    className={`w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:ring-4 ${passwordError
                      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                      : "focus:border-[#5D94E8] focus:ring-[#5D94E8]/10"
                      }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
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

                {passwordError && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* LOGIN ERROR */}
              {generalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {generalError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5D94E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4B82D6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* ACCOUNT REQUEST */}
            <div className="mt-7 border-t pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?
              </p>

              <p className="mt-1 text-sm font-medium text-[#203264]">
                Please contact the church administration
                to request access.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}