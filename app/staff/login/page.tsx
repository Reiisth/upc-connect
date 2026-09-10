"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function StaffLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setErrorMessage("The email or password you entered is incorrect.");
        } else {
          setErrorMessage(error.message);
        }

        return;
      }

      if (!data.user) {
        setErrorMessage("Unable to authenticate user.");
        return;
      }

      router.push("/staff");
      router.refresh();
    } catch {
      setErrorMessage(
        "Unable to reach the server. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* STAFF BRANDING PANEL */}
        <section className="hidden bg-[#EEF3FB] p-10 text-[#203264] lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-1">
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

              <p className="text-sm text-[#203264]/60">
                United Pentecostal Church Batangas
              </p>
            </div>
          </div>

          <div className="max-w-lg">
            <div className="flex items-center gap-2 text-[#5D94E8]">
              <ShieldCheck className="h-5 w-5" />

              <p className="text-sm font-medium uppercase tracking-widest">
                STAFF PORTAL
              </p>
            </div>

            <h1 className="mt-4 font-heading text-4xl font-semibold leading-tight">
              Manage church operations securely.
            </h1>

            <p className="mt-4 max-w-md leading-7 text-[#203264]/70">
              Access the UPC Connect staff workspace for administration,
              attendance, finance, ministry records, and other authorized
              church operations.
            </p>
          </div>

          <p className="text-xs text-[#203264]/50">
            © UPC Batangas · UPC Connect
          </p>
        </section>

        {/* LOGIN PANEL */}
        <section className="flex items-center justify-center bg-gradient-to-br from-[#2B4F87] via-[#203264] to-[#10192E] px-5 py-8 sm:px-8">
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
                  <p className="font-heading text-xl font-semibold text-[#FFFFFF]">
                    UPC CONNECT
                  </p>

                  <p className="text-sm font-medium text-[#5D94E8]">
                    Staff Portal
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
              <div>
                <div className="flex items-center gap-2 text-[#5D94E8]">
                  <ShieldCheck className="h-4 w-4" />

                  <p className="text-sm font-medium">
                    Authorized Access
                  </p>
                </div>

                <h1 className="mt-2 font-heading text-2xl font-semibold text-[#203264] sm:text-3xl">
                  STAFF LOGIN
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Sign in using your authorized UPC Connect staff account.
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-7 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-[#203264]"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="juandelacruz@gmail.com"
                    required
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                  />
                </div>

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
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Password"
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

                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#203264] px-5 py-3 font-semibold text-white transition hover:bg-[#2C447D] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In to Staff Portal"
                  )}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-xs text-white">
              This portal is intended for authorized UPC Batangas staff only.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

