"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function MemberLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/member/select-profile");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/upc-logo.png"
              alt="UPC Connect"
              width={52}
              height={52}
              priority
            />

            <div>
              <p className="font-heading text-xl font-semibold">
                UPC CONNECT
              </p>
              <p className="text-sm text-white/70">
                United Pentecostal Church Batangas
              </p>
            </div>
          </Link>

          <div className="max-w-xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-white/70">
              Member Portal
            </p>

            <h1 className="font-heading text-5xl font-semibold leading-tight">
              Stay connected with your church community.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-white/75">
              Access your member profile and the profiles connected to your
              account through UPC Connect.
            </p>
          </div>

          <p className="text-sm text-white/60">
            © UPC Batangas · UPC Connect
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/upc-logo.png"
                  alt="UPC Connect"
                  width={52}
                  height={52}
                  priority
                />

                <div>
                  <p className="font-heading text-lg font-semibold text-[#203264]">
                    UPC CONNECT
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Member Portal
                  </p>
                </div>
              </Link>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
              <div>
                <p className="text-sm font-medium text-[#5D94E8]">
                  Welcome back
                </p>

                <h1 className="mt-2 font-heading text-3xl font-semibold text-[#203264]">
                  MEMBER LOGIN
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Sign in using the email address and password connected to
                  your UPC Connect account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-[#203264]"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="juandelacruz@gmail.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none transition placeholder:text-muted-foreground focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-[#203264]"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none transition placeholder:text-muted-foreground focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-gradient px-4 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="mt-6 border-t pt-6 text-center">
                <Link
                  href="/"
                  className="text-sm font-medium text-[#203264] hover:underline"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}